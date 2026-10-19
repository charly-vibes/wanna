// Purpose: plain-data state and the typed-outcome → widget-label mapping for the tambor-rendered review demo (wanna-72s)
// Responsibilities: the ReviewTamborState shape (the projection snapshot the view renders, the textarea draft, the host advance target and the rendered outcome line) and outcomeLabel; no shell semantics — every outcome label is a rendering of a typed outcome the real shell returned
// Rationale: tambor-y9d.2 descope ruling — shell semantics (typed submit outcomes, conditional commit, reconcile, restart durability) are owned by @wanna/composition-shell; this file may only render them
import type { TextareaExtra } from "@tambor/components/textarea/edit.ts";
import type { HeadlessView } from "../review-headless";

/** The demo's plain-data state: everything the view renders is here.
 * `view` is the real shell projection snapshot; the rest is demo controls. */
export interface ReviewTamborState {
  readonly view: HeadlessView;
  /** the host advance control's slider target */
  readonly advanceTo: number;
  /** the textarea draft, written through DRAFT_PATH by the textarea */
  readonly draft: string;
  /** the contextual focus value the textarea compares against its text path
   * (focus_by_path: focused exactly when focus deep-equals DRAFT_PATH) */
  readonly focus: unknown;
  /** the last submit outcome, rendered for the widget */
  readonly outcome: string;
}

/** The textarea's editing-state map, read back from the state the textarea
 * writes through TEXTAREA_EXTRA_PATH (text_state_split: cursor, selection,
 * drag state live in the extra map — it must survive redraws). */
export function textareaExtra(s: ReviewTamborState): TextareaExtra {
  const host = s as ReviewTamborState & { "::extra"?: Record<string, unknown> };
  const map = host["::extra"]?.["review-draft"];
  return map
    ? (map as TextareaExtra)
    : {
        cursor: 0,
        "select-cursor": null,
        "down-pos": null,
        mpos: null,
        "last-click": null,
      };
}

export function initialTamborState(
  view: HeadlessView,
  advanceTo: number,
): ReviewTamborState {
  return {
    view,
    advanceTo,
    draft: "",
    focus: null,
    outcome: "session open — a review is pending",
  };
}

/** The typed submit outcome, rendered as the demo's outcome-line label.
 * One distinct prefix per outcome so the rendered grid can be read back. */
export function outcomeLabel(kind: string, revision?: number): string {
  if (kind === "recorded")
    return `recorded on revision ${String(revision ?? "?")}`;
  if (kind === "stale")
    return "stale — a fresh review of the current revision is required";
  if (kind === "duplicate")
    return "duplicate — this feedback was already recorded";
  if (kind === "unavailable")
    return "unavailable — storage did not answer; retry when it recovers";
  if (kind === "unknown_effect") {
    return "unknown effect — storage lost the acknowledgement; reconcile required";
  }
  return "refused — the shell declined the command";
}
