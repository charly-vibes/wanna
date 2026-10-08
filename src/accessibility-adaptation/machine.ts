// Purpose: accessibility-adaptation state machine
// Responsibilities: the four transitions (check, accept, fallback, reject) with their guards and the pre-render invariant battery
// Rationale: an inaccessible interaction is never silently rendered — the only exit without an equivalent is an explicit unsupported result
import type {
  AccessibilityPreferences,
  AccessibilityState,
  HostCapabilities,
  InvariantName,
  InvariantReport,
  InteractionContract,
  TransitionId,
  TransitionResult,
} from "./types";
import {
  controlsHaveNames,
  documentsEquivalentOperation,
  focusOrderLogical,
  keyboardEquivalent,
  meaningSurvivesAdaptation,
  obligationsDeclared,
  presentationRespectsPreferences,
  quote,
  statusChangesAnnounced,
} from "./invariants";
import type { Check } from "./invariants";

export const ADAPTER_VERSION = "accessibility-adaptation-adapter@1.0.0";

export interface TransitionRow {
  readonly id: TransitionId;
  readonly from: AccessibilityState;
  readonly to: AccessibilityState;
}

export const ADAPTER_TRANSITIONS: readonly TransitionRow[] = [
  { id: "check_accessibility", from: "proposed", to: "checked" },
  { id: "accept_accessible_render", from: "checked", to: "accessible" },
  { id: "use_accessible_fallback", from: "checked", to: "fallback" },
  { id: "reject_inaccessible_render", from: "checked", to: "unsupported" },
];

interface AdapterContext {
  readonly contract: InteractionContract;
  readonly host: HostCapabilities;
  readonly preferences: AccessibilityPreferences;
}

function fallbackAvailable(ctx: AdapterContext): boolean {
  return (
    ctx.host.supportsKeyboard &&
    keyboardEquivalent(ctx.contract, ctx.host).ok &&
    documentsEquivalentOperation(ctx.contract).ok
  );
}

function hasAccessibleEquivalent(ctx: AdapterContext): boolean {
  return meaningSurvivesAdaptation(ctx.contract, ctx.contract.adaptation).ok || fallbackAvailable(ctx);
}

function inaccessibleReport(ctx: AdapterContext): InvariantReport {
  return hasAccessibleEquivalent(ctx)
    ? {
        invariant: "inaccessible_interaction_not_silently_rendered",
        ok: true,
        reason: "an accessible equivalent exists",
      }
    : {
        invariant: "inaccessible_interaction_not_silently_rendered",
        ok: true,
        reason:
          "no accessible equivalent exists — the adapter reports an explicit unsupported result instead of rendering",
      };
}

function evaluateInvariants(ctx: AdapterContext): readonly InvariantReport[] {
  const battery: readonly [InvariantName, Check][] = [
    ["controls_have_names", controlsHaveNames(ctx.contract)],
    ["keyboard_equivalent", keyboardEquivalent(ctx.contract, ctx.host)],
    ["focus_order_logical", focusOrderLogical(ctx.contract)],
    ["status_changes_announced", statusChangesAnnounced(ctx.contract, ctx.host)],
    ["meaning_survives_adaptation", meaningSurvivesAdaptation(ctx.contract, ctx.contract.adaptation)],
    [
      "motion_and_density_respect_preferences",
      presentationRespectsPreferences(ctx.contract, ctx.host, ctx.preferences),
    ],
    ["accessibility_obligations_semantic", obligationsDeclared(ctx.contract)],
    ["modality_equivalence_explicit", documentsEquivalentOperation(ctx.contract)],
  ];
  const reports: InvariantReport[] = battery.map(([invariant, check]) => ({ invariant, ...check }));
  reports.push(inaccessibleReport(ctx));
  return reports;
}

function checkGuard(_ctx: AdapterContext, contract: InteractionContract): TransitionResult {
  return controlsHaveNames(contract);
}

function fallbackGuard(ctx: AdapterContext): TransitionResult {
  if (!ctx.host.supportsKeyboard) {
    return {
      ok: false,
      reason:
        "keyboard_equivalent does not hold: the host does not support keyboard input, so no keyboard fallback can be documented",
    };
  }
  const keyboard = keyboardEquivalent(ctx.contract, ctx.host);
  if (!keyboard.ok) return keyboard;
  return documentsEquivalentOperation(ctx.contract);
}

function rejectGuard(ctx: AdapterContext): TransitionResult {
  if (hasAccessibleEquivalent(ctx)) {
    return {
      ok: false,
      reason: `reject_inaccessible_render refused: interaction ${quote(ctx.contract.contractId)} has an accessible equivalent — accept the accessible render or use the documented fallback`,
    };
  }
  return { ok: true };
}

function guardFor(ctx: AdapterContext, id: TransitionId): TransitionResult {
  if (id === "check_accessibility") return checkGuard(ctx, ctx.contract);
  if (id === "accept_accessible_render") {
    return meaningSurvivesAdaptation(ctx.contract, ctx.contract.adaptation);
  }
  if (id === "use_accessible_fallback") return fallbackGuard(ctx);
  return rejectGuard(ctx);
}

function unsupportedReasonFor(contract: InteractionContract): string {
  return `interaction ${quote(contract.contractId)} has no accessible equivalent for the declared host capabilities and preferences — the interaction is unsupported`;
}

function enterChecked(ctx: AdapterContext): Partial<Internals> {
  return { state: "checked", checkReport: evaluateInvariants(ctx), unsupportedReason: null };
}

function enterUnsupported(ctx: AdapterContext): Partial<Internals> {
  return { state: "unsupported", unsupportedReason: unsupportedReasonFor(ctx.contract) };
}

function applyEffect(ctx: AdapterContext, id: TransitionId): Partial<Internals> {
  if (id === "check_accessibility") return enterChecked(ctx);
  if (id === "use_accessible_fallback") return { state: "fallback" };
  if (id === "accept_accessible_render") return { state: "accessible" };
  return enterUnsupported(ctx);
}

interface Internals extends AdapterContext {
  state: AccessibilityState;
  checkReport: readonly InvariantReport[] | null;
  unsupportedReason: string | null;
}

function fireTransition(internals: Internals, id: TransitionId): TransitionResult {
  const row = ADAPTER_TRANSITIONS.find((r) => r.id === id);
  if (!row) return { ok: false, reason: `unknown transition ${id}` };
  if (internals.state !== row.from) {
    return { ok: false, reason: `transition ${id} cannot fire from state ${internals.state}` };
  }
  const guard = guardFor(internals, id);
  if (!guard.ok) return guard;
  Object.assign(internals, applyEffect(internals, id));
  return { ok: true };
}

function makeMachine(internals: Internals) {
  return {
    get contract() {
      return internals.contract;
    },
    get host() {
      return internals.host;
    },
    get preferences() {
      return internals.preferences;
    },
    get state() {
      return internals.state;
    },
    get checkReport() {
      return internals.checkReport;
    },
    get unsupportedReason() {
      return internals.unsupportedReason;
    },
    fire: (id: TransitionId) => fireTransition(internals, id),
  };
}

export type AccessibilityAdapter = ReturnType<typeof makeMachine>;

export function createAccessibilityAdapter(
  contract: InteractionContract,
  host: HostCapabilities,
  preferences: AccessibilityPreferences,
): AccessibilityAdapter {
  const internals: Internals = {
    contract,
    host,
    preferences,
    state: "proposed",
    checkReport: null,
    unsupportedReason: null,
  };
  return makeMachine(internals);
}
