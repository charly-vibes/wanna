// Purpose: the demo's shell-action vectors (wanna-72s) — the demo-* registry
//   handlers that bridge tambor's synchronous dispatch to the shell's async
//   commands
// Responsibilities: register demo-advance / demo-request / demo-submit /
//   demo-fresh / demo-reconcile on the per-app registry; each fires the real
//   HeadlessReviewClient command, then refreshes the folded projection through
//   a sync refresh vector rendered by outcomeLabel — the shell owns every
//   outcome, this only renders it
// Rationale: tambor-y9d.2 descope ruling — no shell semantics re-implemented;
//   extracted from index.ts for the file-shape gate. The fire-then-refresh
//   bridge is seam plumbing, not policy.
import type { InterHandler } from "@tambor/interop/seam.ts";
import type { HeadlessReviewClient, HeadlessView } from "../review-headless";
import { outcomeLabel, type ReviewTamborState } from "./state";

/** What a shell action reports back: the rendered label and the fresh view. */
interface ActionOutcome {
  readonly label: string;
  readonly view?: HeadlessView;
}

/** The mutable holder for the ops app — the registry is built before
 * makeOpsApp returns, so async completions dispatch through the holder. */
export interface AppHolder {
  readonly app: { value?: { dispatch(batch: unknown): void } | undefined };
}

/** Async bridge: fire the shell command, then refresh via a sync vector. */
function shellAction(
  holder: { app: { value?: { dispatch(batch: unknown): void } | undefined } },
  client: () => HeadlessReviewClient | null,
  track: (p: Promise<unknown>) => void,
  act: (
    c: HeadlessReviewClient,
    args: readonly unknown[],
    state: ReviewTamborState,
  ) => Promise<ActionOutcome>,
): InterHandler {
  return (state, ...args) => {
    const c = client();
    if (c === null) return state;
    track(
      act(c, args, state as ReviewTamborState)
        .then((outcome) => {
          holder.app.value?.dispatch([
            ["refresh", outcome.view ?? c.view(), outcome.label],
          ]);
        })
        .catch((e: unknown) => {
          const reason = e instanceof Error ? e.message : String(e);
          holder.app.value?.dispatch([
            ["refresh", c.view(), `refused — ${reason}`],
          ]);
        }),
    );
    return state;
  };
}

/** Register the demo-* shell-action vectors on the per-app registry. */
export function registerShellActions(
  registry: Map<string, InterHandler>,
  holder: { app: { value?: { dispatch(batch: unknown): void } | undefined } },
  client: () => HeadlessReviewClient | null,
  track: (p: Promise<unknown>) => void,
): void {
  const action = (
    act: (
      c: HeadlessReviewClient,
      args: readonly unknown[],
      state: ReviewTamborState,
    ) => Promise<ActionOutcome>,
  ) => shellAction(holder, client, track, act);

  /** Host-owned artifact advance (the slider + Advance button). */
  registry.set(
    "demo-advance",
    action((c, args) =>
      c.advanceArtifact(args[0] as number, args[1] as string).then((kind) => ({
        label:
          kind === "applied"
            ? `artifact advanced to revision ${String(args[0])}`
            : outcomeLabel("refused"),
        view: c.view(),
      })),
    ),
  );

  /** Review request for the current revision. */
  registry.set(
    "demo-request",
    action((c, args) =>
      c.requestReview(args[0] as number).then((kind) => ({
        label:
          kind === "requested"
            ? `review of revision ${String(args[0])} pending`
            : outcomeLabel("refused"),
        view: c.view(),
      })),
    ),
  );

  /** Feedback submission: the textarea draft against the displayed revision. */
  const lastEvent = { id: "" };
  registry.set(
    "demo-submit",
    action((c, args, state) => {
      const eventId =
        (args[0] as string | undefined) ??
        `event-r${String(state.view.taskRevision)}`;
      lastEvent.id = eventId;
      return c.submitFeedback(eventId, state.draft).then((outcome) => ({
        label:
          outcome.kind === "recorded"
            ? outcomeLabel("recorded", outcome.revision)
            : outcomeLabel(outcome.kind),
        view: c.view(),
      }));
    }),
  );

  /** Retire any pending review and open a fresh one for the current revision. */
  registry.set(
    "demo-fresh",
    action((c) =>
      c.freshReview().then((kind) => ({
        label:
          kind === "active"
            ? `fresh review of revision ${String(c.view().taskRevision)} active`
            : outcomeLabel("refused"),
        view: c.view(),
      })),
    ),
  );

  /** Reconcile the uncertain commit (defaults to the last submitted event). */
  registry.set(
    "demo-reconcile",
    action((c, args) => {
      const operationId = (args[0] as string | undefined) || lastEvent.id;
      return c.reconcile(operationId).then((kind) => ({
        label:
          kind === "refused"
            ? outcomeLabel("unknown_effect")
            : `reconciled: ${kind} — mutations are unblocked`,
        view: c.view(),
      }));
    }),
  );
}
