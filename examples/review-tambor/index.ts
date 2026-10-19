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
import { applyTextareaIntents } from "@tambor/components/textarea/edit.ts";
import { makeOpsApp } from "@tambor/interop/app.ts";
import {
  makeRegistry,
  seamSelect,
  seamSet,
  type InterHandler,
} from "@tambor/interop/seam.ts";
import { updatePath, type Path } from "@tambor/effects/paths.ts";
import type { Elem } from "@tambor/views/model.ts";
import { openHeadlessReview, type HeadlessView } from "../review-headless";
import type { OpenReviewSessionInput } from "@wanna/composition-shell";
import { registerShellActions, type AppHolder } from "./actions";
import { makeFaultPort, type FaultPort, type PortFault } from "./port";
import { initialTamborState, type ReviewTamborState } from "./state";
import { reviewTamborView } from "./view";

// the demo's path vocabulary, re-exported for hosts and UI-driving tests
export { DRAFT_PATH } from "./view";

/** The textarea editing intents applyTextareaIntents applies itself; the
 * app-level registry must route them through the interpreter or the
 * textarea's typing/editing is silently dropped (unknown tags are skipped). */
const TEXTAREA_INTENTS: readonly string[] = [
  "insert-text",
  "insert-newline",
  "delete-backward",
  "backward-char",
  "forward-char",
  "previous-line",
  "next-line",
];

/** A corpus-dialect path: every step is a navigator (the corpus walk —
 * paths-walk — rejects plain keys). The textarea and the slider emit in
 * different dialects; the bridge routes each to its own walker. */
function isCorpusPath(path: unknown): boolean {
  return (
    Array.isArray(path) &&
    path.length > 0 &&
    (path as readonly unknown[]).every(
      (s) => Array.isArray(s) && s[0] === "keypath",
    )
  );
}

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
  | {
      readonly kind: "rejected" | "unavailable" | "recovery_required";
      readonly reason: string;
    };

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

  /** request-focus: the textarea's mouse-down asks for focus; the demo
   * keeps the contextual focus value in the state (focus_by_path). */
  r.set("request-focus", (state, path) => ({
    ...(state as ReviewTamborState),
    focus: path,
  }));

  /** The textarea editing intents, applied by the corpus interpreter —
   * editing state (text via DRAFT_PATH, caret via the extra map) is
   * demo state; the shell semantics stay untouched. */
  for (const intent of TEXTAREA_INTENTS) {
    r.set(
      intent,
      (state, ...args) =>
        applyTextareaIntents(state, [[intent, ...args]])
          .state as ReviewTamborState,
    );
  }

  /** The update bridge: the textarea's cursor/selection writes arrive as
   * corpus-dialect updates (its interpreter walks navigator paths), the
   * slider's as plain seam-dialect updates — route each to its walker. */
  r.set("update", (state, path, f) => {
    const fn = f as (old: unknown) => unknown;
    if (isCorpusPath(path)) {
      return updatePath(state, path as Path, fn);
    }
    return seamSet(
      state,
      path as readonly unknown[],
      fn(seamSelect(state, path as readonly unknown[])),
    );
  });

  return r;
}

/**
 * Open the tambor-rendered review demo over the real shell. The host's port is
 * wrapped by the demo's fault-injecting port (declared infrastructure); the
 * shell sees the same port contract either way.
 */
export async function openTamborReview(
  input: TamborOpenInput,
): Promise<TamborOpenOutcome> {
  const faults = makeFaultPort(input.port);
  const opened = await openHeadlessReview({ ...input, port: faults });
  if (!("client" in opened)) {
    return { kind: opened.kind, reason: opened.reason };
  }
  const client = opened.client;
  const state = initialTamborState(
    client.view(),
    client.view().taskRevision + 1,
  );
  // the settle chain: every tracked shell command extends the tail; every
  // settle() caller awaits the SAME chain, so concurrent callers (the mount
  // wire's re-draw and a test's assertion) never steal each other's work
  const tail: { promise: Promise<unknown> } = { promise: Promise.resolve() };
  const track = (p: Promise<unknown>): void => {
    tail.promise = tail.promise.then(
      () => p,
      () => p,
    );
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
