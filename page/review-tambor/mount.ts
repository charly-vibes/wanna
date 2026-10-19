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
//   The CELL_SCALE stage is demo presentation: tambor's DomBackend draws unit
//   coordinates as raw px while text renders at browser size, so the mounted
//   tree collapses (tambor's own logo-gallery screenshot shows the same
//   overlap) — the stage renders 1 unit as CELL_SCALE px and divides event
//   positions back to units before routing. Presentation only: geometry stays
//   in unit space for routing and assertions.
import { bounds } from "@tambor/views/model.ts";
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

/** How many px one unit cell renders as: the browser's default text size,
 * so a 1-unit row shows as one readable text line. */
export const CELL_SCALE = 16;

/** The mounted page handle: tambor's SpaHandle shape plus the demo's async
 * settle affordance and the scaled stage. */
export interface ReviewPageHandle {
  readonly backend: DomBackend;
  readonly app: TamborReviewApp;
  readonly root: RealDomElement;
  readonly surface: RealDomElement;
  /** the scaled stage: 1 unit = CELL_SCALE px, root and surface inside */
  readonly stage: RealDomElement;
  /** resolves when in-flight shell commands have refreshed the projection,
   * then re-draws the current view into the document */
  settleAndRedraw(): Promise<void>;
  unmount(): void;
}

/** The wire: route, dispatch, re-draw — then the settle re-draw. A
 * request-focus intent also focuses the real surface so keydown/paste
 * flow into the corpus in a real browser (tambor-e5n's DOM-focus leg). */
function wireSurface(
  backend: DomBackend,
  app: TamborReviewApp,
  scale: number,
  focusTarget: HostElement,
): void {
  backend.subscribe((ev: TamborEvent) => {
    const routed = rescalePointer(ev, scale);
    const intents = dispatch(app.view(), routed);
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

/** Pointer events arrive in scaled client px; routing and hit-testing are in
 * unit coordinates — divide the position back (keyboard/clipboard pass through). */
function rescalePointer(ev: TamborEvent, scale: number): TamborEvent {
  const candidate = ev as { type?: string; pos?: readonly number[] };
  if (candidate.pos === undefined || !candidate.type?.startsWith("mouse")) {
    return ev;
  }
  return {
    ...(candidate as unknown as Record<string, unknown>),
    pos: [candidate.pos[0]! / scale, candidate.pos[1]! / scale],
  } as unknown as TamborEvent;
}

/** Every drawn element renders as one unit cell: 1px text pre-scale (the
 * stage's transform scales it back up), no button chrome that would break
 * the cell grid, and the paper ink so the drawn tree is readable on the
 * light stage regardless of the page theme. */
const INK = "#16161d";

function cellFactory(doc: HostDoc): ReturnType<typeof realDomFactory> {
  const inner = realDomFactory(doc);
  return (tag: string) => {
    const el = inner(tag);
    el.style["font-size"] = "1px";
    el.style["line-height"] = "1px";
    el.style["color"] = INK;
    if (tag === "button") {
      el.style["padding"] = "0";
      el.style["border"] = "none";
      el.style["background"] = "none";
    }
    return el;
  };
}

/** The stage chrome: footprint reservation plus the paper ground so the
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
  stage.host.style.setProperty("font-size", "1px");
  stage.host.style.setProperty("line-height", "1px");
  stage.host.style.setProperty("background", "#fbfaf7");
  stage.host.style.setProperty("color", INK);
  stage.host.style.setProperty("border-radius", "10px");
  stage.host.style.setProperty("box-shadow", "0 2px 18px rgba(0,0,0,0.45)");
  stage.host.style.setProperty("overflow", "hidden");
}

/** The scaled stage: the footprint reservation (outer), the transform
 * wrapper, and the transparent input surface, all in one subtree. */
function buildStage(
  doc: HostDoc,
  app: TamborReviewApp,
  backend: DomBackend,
  scale: number,
): { stage: RealDomElement; surface: RealDomElement; root: RealDomElement } {
  const [viewW, viewH] = bounds(app.view());
  const stage = new RealDomElement("div", doc);
  styleStage(stage, viewW, viewH, scale);
  // the wrapper carries the transform (the root's absolute-positioned
  // children have no intrinsic box of their own)
  const wrapper = new RealDomElement("div", doc);
  wrapper.host.style.setProperty("transform", `scale(${String(scale)})`);
  wrapper.host.style.setProperty("transform-origin", "0 0");
  stage.host.appendChild(wrapper.host);

  const root = backend.root as RealDomElement;
  wrapper.host.appendChild(root.host);

  const surface = new RealDomElement("canvas", doc);
  // the surface is the keyboard target (tambor-huu tabindex)
  surface.host.setAttribute("tabindex", "0");
  surface.host.style.setProperty("position", "absolute");
  surface.host.style.setProperty("left", "0px");
  surface.host.style.setProperty("top", "0px");
  surface.host.style.setProperty("width", `${viewW}px`);
  surface.host.style.setProperty("height", `${viewH}px`);
  wrapper.host.appendChild(surface.host);
  backend.attach(surface);

  return { stage, surface, root };
}

/** Mount the review demo into `container` of `doc`, rendered at CELL_SCALE. */
export function mountReviewDemo(
  doc: HostDoc,
  container: HostElement,
  app: TamborReviewApp,
  containerSize: readonly [number, number],
  scale: number = CELL_SCALE,
): ReviewPageHandle {
  const backend = new DomBackend({
    createElement: cellFactory(doc),
    containerSize: containerSize as unknown as [number, number],
  });

  const { stage, surface, root } = buildStage(doc, app, backend, scale);
  wireSurface(backend, app, scale, surface.host);
  backend.draw(app.view());
  container.appendChild(stage.host);

  return {
    backend,
    app,
    root,
    surface,
    stage,
    settleAndRedraw: async (): Promise<void> => {
      await app.settle();
      backend.draw(app.view());
    },
    unmount: (): void => {
      container.removeChild(stage.host);
    },
  };
}
