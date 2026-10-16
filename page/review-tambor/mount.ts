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

/** The mounted page handle: tambor's SpaHandle shape plus the demo's async
 * settle affordance. */
export interface ReviewPageHandle {
  readonly backend: DomBackend;
  readonly app: TamborReviewApp;
  readonly root: RealDomElement;
  readonly surface: RealDomElement;
  /** resolves when in-flight shell commands have refreshed the projection,
   * then re-draws the current view into the document */
  settleAndRedraw(): Promise<void>;
  unmount(): void;
}

/** The corpus wire (tambor spa/mount.ts shape): route, dispatch, re-draw;
 * the settle re-draw is the one demo-owned addition (async shell commands). */
function wireSurface(backend: DomBackend, app: TamborReviewApp): void {
  backend.subscribe((ev: TamborEvent) => {
    const intents = dispatch(app.view(), ev);
    if (intents.length > 0) app.dispatch(intents);
    backend.draw(app.view());
    void app.settle().then(() => backend.draw(app.view()));
  });
}

/** Mount the review demo into `container` of `doc`. */
export function mountReviewDemo(
  doc: HostDoc,
  container: HostElement,
  app: TamborReviewApp,
  containerSize: readonly [number, number],
): ReviewPageHandle {
  const backend = new DomBackend({
    createElement: realDomFactory(doc),
    containerSize: containerSize as unknown as [number, number],
  });
  wireSurface(backend, app);

  const root = backend.root as RealDomElement;
  container.appendChild(root.host);

  const surface = new RealDomElement("canvas", doc);
  container.appendChild(surface.host);
  backend.attach(surface);

  backend.draw(app.view());

  return {
    backend,
    app,
    root,
    surface,
    settleAndRedraw: async (): Promise<void> => {
      await app.settle();
      backend.draw(app.view());
    },
    unmount: (): void => {
      container.removeChild(root.host);
      container.removeChild(surface.host);
    },
  };
}
