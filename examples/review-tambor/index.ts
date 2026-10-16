// Purpose: the tambor-rendered review demo app (wanna-72s) — the REAL shell
//   session mounted through tambor's widget vocabulary
// Responsibilities: open the shell via the headless consumer (the coordination
//   layer: typed outcomes, displayed-revision bookkeeping, fresh review),
//   build the per-app ops seam (makeOpsApp — never the global registry) over
//   the refresh/arm-fault handlers plus the demo-* shell actions
//   (actions.ts), and expose settle/armFault for hosts and tests
// Rationale: tambor-y9d.2 descope ruling — no shell semantics are
//   re-implemented here: every command routes through the HeadlessReviewClient
//   over the public barrel, the port wrapper (port.ts) is declared
//   infrastructure, and this file adds only seam plumbing. Pattern reference:
//   tambor's logo example (per-app registry + view/dispatch/getState wire).
import { makeOpsApp, type OpsApp } from "@tambor/interop/app.ts";
import { makeRegistry, type InterHandler } from "@tambor/interop/seam.ts";
import type { Elem } from "@tambor/views/model.ts";
import {
  openHeadlessReview,
  type HeadlessView,
} from "../review-headless";
import type { OpenReviewSessionInput } from "@wanna/composition-shell";
import { registerShellActions, type AppHolder } from "./actions";
import { makeFaultPort, type FaultPort, type PortFault } from "./port";
import { initialTamborState, type ReviewTamborState } from "./state";
import { reviewTamborView } from "./view";

// the demo's path vocabulary, re-exported for hosts and UI-driving tests
export { DRAFT_PATH } from "./view";

/** Input the demo adds to the shell's open input: the artifact identity. */
type TamborOpenInput = OpenReviewSessionInput & { readonly artifactId: string };

/** The demo app wire: the tambor App shape plus the test/host affordances. */
export interface TamborReviewApp {
  /** the current tambor view (projection → widgets) */
  view(): Elem;
  /** tambor seam dispatch — the same path a button click routes through */
  dispatch(batch: unknown): void;
  /** the plain-data state the view renders */
  getState(): ReviewTamborState;
  /** resolves when in-flight shell commands have refreshed the projection */
  settle(): Promise<void>;
  /** arm the demo's fault-injecting port wrapper */
  armFault(kind: PortFault, count: number): void;
}

/** The open-failure variants, surfaced verbatim from the shell construction. */
export type TamborOpenOutcome =
  | { readonly kind: "ready"; readonly app: TamborReviewApp }
  | { readonly kind: "rejected" | "unavailable" | "recovery_required"; readonly reason: string };

/** The per-app sync handlers: projection refresh and fault arming. */
function demoHandlers(faults: FaultPort): Map<string, InterHandler> {
  const r = makeRegistry();

  /** Fold a fresh projection snapshot (and outcome line) into the state. */
  r.set("refresh", (state, view, outcome) => ({
    ...(state as ReviewTamborState),
    view: view as HeadlessView,
    outcome: (outcome as string) ?? (state as ReviewTamborState).outcome,
  }));

  /** Arm a port fault (the demo's storage-down / lose-ack buttons). */
  r.set("arm-fault", (state, fault, count) => {
    faults.arm(fault as PortFault, count as number);
    return {
      ...(state as ReviewTamborState),
      outcome: `fault armed: ${String(fault)} × ${String(count)}`,
    };
  });

  return r;
}

/**
 * Open the tambor-rendered review demo over the real shell. The host's port is
 * wrapped by the demo's fault-injecting port (declared infrastructure); the
 * shell sees the same port contract either way.
 */
export async function openTamborReview(input: TamborOpenInput): Promise<TamborOpenOutcome> {
  const faults = makeFaultPort(input.port);
  const opened = await openHeadlessReview({ ...input, port: faults });
  if (!("client" in opened)) {
    return { kind: opened.kind, reason: opened.reason };
  }
  const client = opened.client;
  const state = initialTamborState(client.view(), client.view().taskRevision + 1);
  // the settle chain: every tracked shell command extends the tail; every
  // settle() caller awaits the SAME chain, so concurrent callers (the mount
  // wire's re-draw and a test's assertion) never steal each other's work
  const tail: { promise: Promise<unknown> } = { promise: Promise.resolve() };
  const track = (p: Promise<unknown>): void => {
    tail.promise = tail.promise.then(() => p, () => p);
  };
  // the registry closes over the holder (assigned once makeOpsApp returns)
  const holder: AppHolder = { app: {} };
  const registry = demoHandlers(faults);
  registerShellActions(registry, holder, () => client, track);
  const opsApp = makeOpsApp({ state, registry });
  holder.app.value = opsApp;
  const app: TamborReviewApp = {
    view: () => reviewTamborView(opsApp.getState() as ReviewTamborState),
    dispatch: (batch: unknown) => {
      opsApp.dispatch(batch);
    },
    getState: () => opsApp.getState() as ReviewTamborState,
    settle: async (): Promise<void> => {
      await tail.promise;
    },
    armFault: (kind: PortFault, count: number) => {
      opsApp.dispatch([["arm-fault", kind, count]]);
    },
  };
  return { kind: "ready", app };
}
