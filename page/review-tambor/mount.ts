// Purpose: the mount glue for the gh-pages review-tambor demo (wanna-8ay) —
//   the REAL shell demo drawn into a live document through tambor's
//   DomBackend + realDomFactory
// Responsibilities: one DomBackend over the demo's TamborReviewApp with the
//   real-DOM element factory; the subscription wire routes every forwarded
//   event through tambor's corpus event router, hands the intents to
//   app.dispatch, re-draws — and re-draws again once the demo's async shell
//   commands settle (the sync redraw after dispatch cannot see their result);
//   settleAndRedraw/unmount for hosts and tests
// Rationale: option A (rule-of-5 review of wanna-72s deployment) — mounting
//   plumbing only, following tambor's spa/mount.ts wire; the demo's semantics
//   stay in examples/review-tambor (view mapping + ops seam) and the shell.
//   The structural HostDoc/HostElement seam keeps this testable under jsdom.
//   Scaling is tambor's cellScale option now (wanna-1ha, tambor GH#1): the
//   backend renders one unit as k px inside its own scaled stage and divides
//   pointer/wheel coordinates back to units — the demo-local stage wrapper,
//   1px clamp factory and pointer rescale from the workaround era are gone.
//   wanna keeps only demo presentation: the paper-chrome frame, the INK ink,
//   the transparent keyboard/pointer surface, and fit-to-width narrowing.
import { bounds, type Elem } from "@tambor/views/model.ts";
import { DomBackend } from "@tambor/render/dom.ts";
import {
  RealDomElement,
  realDomFactory,
  type HostDoc,
  type HostElement,
} from "@tambor/interop/domhost.ts";
import { dispatch } from "@tambor/events/dispatch.ts";
import type { TamborEvent } from "@tambor/events/event.ts";
import type { TamborReviewApp } from "../../examples/review-tambor";

/** How many px one unit cell renders as (preferred): the browser's default
 * text size, so a 1-unit row shows as one readable text line. Fit-to-width
 * narrows it — see effectiveScale. */
export const CELL_SCALE = 16;

/** The mounted page handle: tambor's SpaHandle shape plus the demo's async
 * settle affordance and the demo's frame around tambor's scaled stage. */
export interface ReviewPageHandle {
  readonly backend: DomBackend;
  readonly app: TamborReviewApp;
  readonly root: RealDomElement;
  readonly surface: RealDomElement;
  /** the demo frame (paper chrome) around tambor's scaled stage: tambor
   * renders 1 unit = one cell px inside it, surface beside the root */
  readonly stage: RealDomElement;
  /** the EFFECTIVE cell scale (CELL_SCALE narrowed to the container width) —
   * hosts and tests convert unit coordinates to client px with it */
  readonly scale: number;
  /** resolves when in-flight shell commands have refreshed the projection,
   * then re-draws the current view into the document */
  settleAndRedraw(): Promise<void>;
  unmount(): void;
}

/** The wire: route, dispatch, re-draw — then the settle re-draw. A
 * request-focus intent also focuses the real surface so keydown/paste
 * flow into the corpus in a real browser (tambor-e5n's DOM-focus leg).
 * Events arrive in unit space — tambor's cellScale backend unscales them. */
function wireSurface(
  backend: DomBackend,
  app: TamborReviewApp,
  focusTarget: HostElement,
): void {
  backend.subscribe((ev: TamborEvent) => {
    const intents = dispatch(app.view(), ev);
    if (intents.length > 0) {
      app.dispatch(intents);
      const wantsFocus = intents.some(
        (it) => (it as unknown[])[0] === "request-focus",
      );
      if (wantsFocus) focusTarget.focus?.();
    }
    backend.draw(app.view());
    void app.settle().then(() => backend.draw(app.view()));
  });
}

/** The demo ink: paper-gray text so the drawn tree reads cleanly on the
 * light stage regardless of the page theme (scaling/clamping is tambor's). */
const INK = "#16161d";

function inkFactory(doc: HostDoc): (tag: string) => RealDomElement {
  const inner = realDomFactory(doc);
  return (tag: string) => {
    const el = inner(tag);
    el.style["color"] = INK;
    return el;
  };
}

/** The frame chrome: footprint reservation plus the paper ground so the
 * drawn tree reads cleanly on light, high-contrast ink. */
function styleStage(
  stage: RealDomElement,
  viewW: number,
  viewH: number,
  scale: number,
): void {
  stage.host.style.setProperty("position", "relative");
  stage.host.style.setProperty("width", `${viewW * scale}px`);
  stage.host.style.setProperty("height", `${viewH * scale}px`);
  stage.host.style.setProperty("background", "#fbfaf7");
  stage.host.style.setProperty("color", INK);
  stage.host.style.setProperty("border-radius", "10px");
  stage.host.style.setProperty("box-shadow", "0 2px 18px rgba(0,0,0,0.45)");
  stage.host.style.setProperty("overflow", "hidden");
}

/** The input surface beside the scaled stage: the keyboard target
 * (tambor-huu tabindex) and the pointer origin, exactly overlaying the
 * stage's bounds×k px footprint. Tambor's attach divides positions by the
 * cell scale — the surface rect IS that footprint. */
function mountSurface(
  doc: HostDoc,
  viewW: number,
  viewH: number,
  scale: number,
  backend: DomBackend,
): RealDomElement {
  const surface = new RealDomElement("canvas", doc);
  surface.host.setAttribute("tabindex", "0");
  surface.host.style.setProperty("position", "absolute");
  surface.host.style.setProperty("left", "0px");
  surface.host.style.setProperty("top", "0px");
  surface.host.style.setProperty("width", `${viewW * scale}px`);
  surface.host.style.setProperty("height", `${viewH * scale}px`);
  backend.attach(surface);
  return surface;
}

/** The EFFECTIVE cell scale: never wider than the container (wanna-hbm) —
 * at a mobile width the preferred CELL_SCALE would overflow horizontally, so
 * the stage scales down to fit; pointer routing and assertions use the same
 * effective scale (geometry stays in unit space). */
export function effectiveScale(
  preferred: number,
  containerWidth: number,
  view: Elem,
): number {
  return Math.min(preferred, containerWidth / bounds(view)[0]);
}

/** Mount the review demo into `container` of `doc`, rendered at CELL_SCALE
 * narrowed to the container width (fit-to-width, wanna-hbm). Tambor's
 * cellScale option owns the scaled stage; the demo frame adds paper chrome
 * and hosts the input surface beside it. */
export function mountReviewDemo(
  doc: HostDoc,
  container: HostElement,
  app: TamborReviewApp,
  containerSize: readonly [number, number],
  scale: number = CELL_SCALE,
): ReviewPageHandle {
  const [viewW, viewH] = bounds(app.view());
  const eff = effectiveScale(scale, containerSize[0], app.view());

  const backend = new DomBackend({
    createElement: inkFactory(doc),
    containerSize: containerSize as unknown as [number, number],
    cellScale: eff,
  });
  const root = backend.root as RealDomElement;

  const stage = new RealDomElement("div", doc);
  styleStage(stage, viewW, viewH, eff);
  stage.host.appendChild(root.host);
  const surface = mountSurface(doc, viewW, viewH, eff, backend);
  stage.host.appendChild(surface.host);

  wireSurface(backend, app, surface.host);
  backend.draw(app.view());
  container.appendChild(stage.host);

  return {
    backend,
    app,
    root,
    surface,
    stage,
    scale: eff,
    ...pageHandle(container, stage, backend, app),
  };
}

/** The lifecycle half of the handle: settle-and-redraw and unmount. */
function pageHandle(
  container: HostElement,
  stage: RealDomElement,
  backend: DomBackend,
  app: TamborReviewApp,
): Pick<ReviewPageHandle, "settleAndRedraw" | "unmount"> {
  return {
    settleAndRedraw: async (): Promise<void> => {
      await app.settle();
      backend.draw(app.view());
    },
    unmount: (): void => {
      container.removeChild(stage.host);
    },
  };
}
