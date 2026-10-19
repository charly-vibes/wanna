// Purpose: the tambor view mapping for the review demo (wanna-72s) — projection
//   state → tambor widgets
// Responsibilities: render the REAL shell projection (ReviewTamborState.view)
//   with the corpus widget vocabulary — slider (components.numeric) for the
//   host advance target, textarea (components.textarea) for the feedback
//   draft, buttons that carry effect vectors for the shell actions and the
//   demo fault controls, labels for status/history/outcome
// Rationale: tambor-y9d.2 descope ruling — demo-local logic is the view
//   mapping only; every button vector routes through the per-app ops seam
//   (makeOpsApp), exactly the path a mounted click would take
import type { IntentList } from "@tambor/events/bubble.ts";
import { call, render } from "@tambor/model/component.ts";
import { slider } from "@tambor/components/numeric/slider.ts";
import { textarea } from "@tambor/components/textarea/textarea.ts";
import { indexForPosition, measureUnit } from "@tambor/render/backend.ts";
import {
  button,
  label as labelNode,
  withColor,
  type Color,
  type Elem,
} from "@tambor/views/model.ts";
import { verticalLayout } from "@tambor/views/layout.ts";
import type { Path } from "@tambor/effects/paths.ts";
import { textareaExtra, type ReviewTamborState } from "./state.ts";

/** Failure ink for the outcome line and the fault buttons. */
const ALERT: Color = [0.7, 0.149, 0.118];

/** The demo's path vocabulary (plain arrays of host-data steps). Plain
 * paths are the interop seam dialect (set/update builtins walk them as
 * plain keys); the textarea carries CORPUS paths (navigator steps) because
 * its intent interpreter is the corpus walk — see TEXTAREA_TEXT_PATH. */
const step = (...steps: readonly string[]): Path => steps as unknown as Path;
const stepKeypath = (...keys: readonly string[]): Path =>
  keys.map((k) => ["keypath", k]) as unknown as Path;
export const DRAFT_PATH: Path = step("draft");
export const ADVANCE_TO_PATH: Path = step("advanceTo");
const SLIDER_MDOWN_PATH: Path = step("slider-mdown?");
const TEXTAREA_TEXT_PATH: Path = stepKeypath("draft");
const TEXTAREA_EXTRA_PATH: Path = stepKeypath("::extra", "review-draft");

/** A button whose click returns the one effect vector its arguments spell. */
function fxButton(text: string, ...vector: readonly unknown[]): Elem {
  return button(text, () => [vector] as unknown as IntentList);
}

/** The projection lines: status, pending and completed review history. */
function historyLines(s: ReviewTamborState): Elem[] {
  const view = s.view;
  const pending = view.pendingReviews.map((r) =>
    labelNode(`pending: revision ${String(r.revision)}`),
  );
  const completed = view.completedReviews.map((r) =>
    labelNode(`completed: revision ${String(r.revision)} — "${r.feedback}"`),
  );
  const none: Elem = labelNode("no review history yet");
  return pending.length + completed.length === 0
    ? [none]
    : [...pending, ...completed];
}

/** The host advance control: a revision-target slider plus the advance button. */
function advanceRow(s: ReviewTamborState): Elem {
  return verticalLayout([
    labelNode(`artifact at revision ${String(s.view.taskRevision)}`),
    render(
      call(slider, {
        num: s.advanceTo,
        min: 0,
        max: Math.max(12, s.view.taskRevision + 2),
        "integer?": true,
        "mdown?": false,
        "max-width": 60,
        $num: ADVANCE_TO_PATH,
        "$mdown?": SLIDER_MDOWN_PATH,
      }),
    ) as Elem,
    fxButton(
      "Advance artifact",
      "demo-advance",
      s.advanceTo,
      `artifact-1/revisions/${String(s.advanceTo)}`,
    ),
    fxButton("Request review", "demo-request", s.view.taskRevision),
  ]);
}

/** The reviewer row: the draft textarea, submit and fresh-review buttons. */
function reviewRow(s: ReviewTamborState): Elem {
  return verticalLayout([
    textarea({
      text: s.draft.length === 0 ? null : s.draft,
      // the textarea's interpreter (applyTextareaIntents) walks corpus
      // paths, so its text/extra paths carry navigator steps
      textPath: TEXTAREA_TEXT_PATH,
      extraPath: TEXTAREA_EXTRA_PATH,
      // focus_by_path: the contextual focus value (request-focus sets it)
      focus: s.focus,
      // text_state_split: the editing state is the map the textarea itself
      // writes under TEXTAREA_EXTRA_PATH — a fresh map would reset the
      // cursor/selection on every redraw
      state: textareaExtra(s),
      font: null,
      // the backend service: the glyph cell containing x (backend_contract)
      indexForPosition: (font, text, x, y) =>
        indexForPosition(measureUnit, (font ?? null) as never, text, x, y),
      now: Date.now(),
    }),
    fxButton(
      "Submit feedback",
      "demo-submit",
      `event-${String(s.view.taskRevision)}`,
    ),
    fxButton("Fresh review", "demo-fresh"),
  ]);
}

/** The demo fault controls (infrastructure: they arm the port wrapper). */
function faultRow(s: ReviewTamborState): Elem {
  const failed =
    s.outcome.startsWith("unavailable") || s.outcome.startsWith("unknown");
  return verticalLayout([
    withColor(ALERT, labelNode(failed ? s.outcome : `outcome: ${s.outcome}`)),
    fxButton("Storage down", "arm-fault", "unavailable", 1),
    fxButton("Lose ack", "arm-fault", "unknown_effect", 1),
    fxButton("Reconcile", "demo-reconcile"),
  ]);
}

/** The demo view: the real projection rendered through corpus widgets. */
export function reviewTamborView(s: ReviewTamborState): Elem {
  return verticalLayout([
    labelNode("tambor review"),
    labelNode(
      `task revision ${String(s.view.taskRevision)} — ${s.view.status}`,
    ),
    ...historyLines(s),
    advanceRow(s),
    reviewRow(s),
    faultRow(s),
  ]);
}
