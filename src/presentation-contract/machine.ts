// Purpose: presentation-contract state machine
// Responsibilities: the five transitions (validate, reject, render, fallback, retire) plus adapt/revert on the active surface
// Rationale: unsupported is an explicit outcome — a host without a capability either falls back semantically or returns unsupported
import type {
  Adaptation,
  FallbackRequest,
  HostRenderRequest,
  PresentationContract,
  PresentationState,
  PresentationView,
  TransitionId,
  TransitionResult,
  UncertaintyMetric,
} from "./types";
import { densityBounded, semanticRoleRequired, untrustedTextInert } from "./invariants";
import { fallbackIsSemantic, responseSemanticsPreserved, uncertaintySemanticsPreserved } from "./rendering";
import { activeInteractionStable, adaptationReasonAvailable, revertPermitted } from "./stability";
import { buildView } from "./view";

export interface TransitionRow {
  readonly id: TransitionId;
  readonly from: PresentationState;
  readonly to: PresentationState;
}

export const PRESENTATION_TRANSITIONS: readonly TransitionRow[] = [
  { id: "validate_presentation", from: "proposed", to: "validated" },
  { id: "reject_presentation", from: "proposed", to: "unsupported" },
  { id: "render_with_capabilities", from: "validated", to: "renderable" },
  { id: "use_semantic_fallback", from: "validated", to: "fallback" },
  { id: "retire_presentation", from: "renderable", to: "retired" },
];

interface Internals {
  state: PresentationState;
  contract: PresentationContract;
  view: PresentationView | null;
  activeSurface: readonly string[] | null;
  previousSurface: readonly string[] | null;
  revertible: boolean;
  rejectionReason: string | null;
}

export interface PresentationMachine {
  readonly state: PresentationState;
  readonly contract: PresentationContract;
  readonly view: PresentationView | null;
  readonly activeSurface: readonly string[];
  readonly revertible: boolean;
  readonly rejectionReason: string | null;
  fire(id: TransitionId): TransitionResult;
  render(request: HostRenderRequest): TransitionResult;
  fallback(request: FallbackRequest): TransitionResult;
  adapt(change: Adaptation): TransitionResult;
  revert(): TransitionResult;
}

function arglessEffect(s: Internals, id: TransitionId): TransitionResult {
  if (id === "validate_presentation") {
    const guard = semanticRoleRequired(s.contract);
    if (!guard.ok) return guard;
    s.state = "validated";
    return { ok: true };
  }
  if (id === "reject_presentation") {
    const check = semanticRoleRequired(s.contract);
    if (check.ok) return { ok: false, reason: "reject_presentation requires an unsupported semantic role" };
    s.state = "unsupported";
    s.rejectionReason = check.reason ?? "unsupported semantic role";
    return { ok: true };
  }
  if (s.view === null) {
    return { ok: false, reason: "retire_presentation requires a rendered presentation view" };
  }
  const guard = densityBounded(s.view);
  if (!guard.ok) return guard;
  s.state = "retired";
  return { ok: true };
}

function statefulEffect(s: Internals, id: TransitionId, request: HostRenderRequest | FallbackRequest): TransitionResult {
  if (s.state !== "validated") {
    return { ok: false, reason: `transition ${id} cannot fire from state ${s.state}` };
  }
  const inert = untrustedTextInert(s.contract.texts ?? []);
  if (!inert.ok) return inert;
  if (id === "render_with_capabilities") return renderEffect(s, request as HostRenderRequest);
  return fallbackEffect(s, request as FallbackRequest);
}

function renderEffect(s: Internals, request: HostRenderRequest): TransitionResult {
  const guard = responseSemanticsPreserved(s.contract.actions ?? [], request.actions);
  if (!guard.ok) return guard;
  if (request.uncertainty !== undefined) {
    // supplied metrics ride on the draft as an optional extension field, read defensively
    const supplied =
      (s.contract as PresentationContract & { readonly uncertainty?: readonly UncertaintyMetric[] })
        .uncertainty ?? [];
    const uncertainty = uncertaintySemanticsPreserved(supplied, request.uncertainty);
    if (!uncertainty.ok) return uncertainty;
  }
  s.view = buildView(s.contract, request.actions, request.uncertainty ?? []);
  s.activeSurface = request.actions.map((a) => a.actionId);
  s.state = "renderable";
  return { ok: true };
}

function fallbackEffect(s: Internals, request: FallbackRequest): TransitionResult {
  const declared = s.contract.actions ?? [];
  const guard = fallbackIsSemantic(declared, request);
  if (!guard.ok) return guard;
  const actions = declared.map((a) => ({
    actionId: a.id,
    meaning: a.meaning,
    responseSchema: [...a.responseSchema],
  }));
  s.view = buildView(s.contract, actions, []);
  s.activeSurface = actions.map((a) => a.actionId);
  s.state = "fallback";
  return { ok: true };
}

function fireArgless(s: Internals, id: TransitionId): TransitionResult {
  const row = PRESENTATION_TRANSITIONS.find((r) => r.id === id);
  if (!row) return { ok: false, reason: `unknown transition ${id}` };
  if (s.state !== row.from) {
    return { ok: false, reason: `transition ${id} cannot fire from state ${s.state}` };
  }
  return arglessEffect(s, id);
}

export function createPresentationMachine(draft: PresentationContract): PresentationMachine {
  const s: Internals = {
    state: "proposed",
    contract: draft,
    view: null,
    activeSurface: null,
    previousSurface: null,
    revertible: false,
    rejectionReason: null,
  };
  return {
    get state() { return s.state; },
    get contract() { return s.contract; },
    get view() { return s.view; },
    get activeSurface() { return s.activeSurface ?? []; },
    get revertible() { return s.revertible; },
    get rejectionReason() { return s.rejectionReason; },
    fire(id) {
      if (id === "render_with_capabilities" || id === "use_semantic_fallback") {
        return { ok: false, reason: `transition ${id} requires its machine method (render/fallback)` };
      }
      return fireArgless(s, id);
    },
    render(request) {
      return statefulEffect(s, "render_with_capabilities", request);
    },
    fallback(request) {
      return statefulEffect(s, "use_semantic_fallback", request);
    },
    adapt(change) {
      return adaptSurface(s, change);
    },
    revert() {
      return revertSurface(s);
    },
  };
}

function adaptSurface(s: Internals, change: Adaptation): TransitionResult {
  if (s.activeSurface === null) {
    return { ok: false, reason: `no active response surface in state ${s.state}` };
  }
  const stability = activeInteractionStable(s.activeSurface, change);
  if (!stability.ok) return stability;
  const reason = adaptationReasonAvailable(change);
  if (!reason.ok) return reason;
  s.previousSurface = s.activeSurface;
  s.revertible = revertPermitted(change);
  const material = change.replaceWith ?? change.reorder;
  if (material !== undefined) s.activeSurface = material;
  return { ok: true };
}

function revertSurface(s: Internals): TransitionResult {
  if (s.previousSurface === null) return { ok: false, reason: "no adaptive change to revert" };
  if (!s.revertible) {
    return { ok: false, reason: "this adaptive change is safety-critical; revert is not available" };
  }
  s.activeSurface = s.previousSurface;
  s.previousSurface = null;
  s.revertible = false;
  return { ok: true };
}