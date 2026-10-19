// @vitest-environment jsdom
// Purpose: the mounted-page test for the gh-pages review-tambor demo (wanna-8ay)
// Responsibilities: verify the page's mount glue — the real demo app drawn into a
//   live host document through tambor's DomBackend + realDomFactory, a button
//   click routed through the surface to a shell action, and the async settle
//   re-draw landing in the DOM; this is the executable form of "the demo is
//   visible" — the page the workflow deploys is built from the same glue
// Rationale: option A (rule-of-5 review of wanna-72s deployment) — a wanna-owned
//   gh-pages page keeps the wanna-owned demo code in wanna (y9d.2 ruling); the
//   test drives the real IndexedDB adapter (fake-indexeddb) end to end
import { describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { createReviewIndexDbPort } from "../../src/review-workbench/adapters/review-indexeddb";
import { openTamborReview } from "../../examples/review-tambor";
import {
  mountReviewDemo,
  type ReviewPageHandle,
} from "../../page/review-tambor/mount";
import { bounds } from "@tambor/views/model.ts";
import type { Elem } from "@tambor/views/model.ts";

const FIXTURE = {
  key: { sessionId: "page-session", taskId: "artifact-1" },
  policy: { policyVersion: "fixture-policy-1" },
  catalog: { catalogVersion: "fixture-catalog-1" },
  artifactId: "artifact-1",
} as const;

// The jsdom document, reached structurally (tambor's domhost convention).
function hostDoc(): Document {
  return (globalThis as { document?: unknown }).document as unknown as Document;
}

// The MouseEvent constructor, reached structurally (jsdom supplies it).
function mouseCtor(): new (
  type: string,
  init: { clientX: number; clientY: number },
) => unknown {
  const ctor = (globalThis as { MouseEvent?: unknown }).MouseEvent;
  if (typeof ctor !== "function") throw new Error("MouseEvent unavailable");
  return ctor as new (
    type: string,
    init: { clientX: number; clientY: number },
  ) => unknown;
}

/** The view-tree walk, kept under the gate's per-function complexity cap by
 * splitting shape cases into small helpers. */
interface WalkNode {
  readonly type?: string;
  readonly text?: string;
  readonly drawable?: unknown;
  readonly drawables?: readonly unknown[];
  readonly x?: number;
  readonly y?: number;
}

/** The collected hits, per collector: the walk threads one array per target
 * kind so a textarea hit never pollutes a button lookup. */
const buttonHits: [number, number][] = [];
const textareaHits: [number, number][] = [];

/** Record the drawn centre of a matching button. */
function collectButton(
  node: unknown,
  n: WalkNode,
  text: string,
  dx: number,
  dy: number,
): void {
  if (n.type === "button" && n.text === text) {
    const [w, h] = bounds(node as Elem);
    buttonHits.push([dx + w / 2, dy + h / 2]);
  }
}

/** The KeyboardEvent constructor, reached structurally (jsdom supplies it). */
function keyCtor(): new (type: string, init: { key: string }) => unknown {
  const ctor = (globalThis as { KeyboardEvent?: unknown }).KeyboardEvent;
  if (typeof ctor !== "function") throw new Error("KeyboardEvent unavailable");
  return ctor as new (type: string, init: { key: string }) => unknown;
}

/** Record the drawn centre of a `key-press` handler node (the textarea). */
function collectTextarea(
  node: unknown,
  n: WalkNode & { eventType?: string },
  dx: number,
  dy: number,
): void {
  if (n.type === "handler" && n.eventType === "key-press") {
    const [w, h] = bounds(node as Elem);
    textareaHits.push([dx + w / 2, dy + h / 2]);
  }
}

/** A node's child-carrying fields, flattened into one list. */
function childNodes(n: WalkNode): readonly unknown[] {
  const out: unknown[] = [];
  if (n.drawable !== undefined) out.push(n.drawable);
  if (n.drawables !== undefined) out.push(...n.drawables);
  return out;
}

/** Descend into a node's child-carrying fields. */
function walkChildren(n: WalkNode, text: string, dx: number, dy: number): void {
  for (const child of childNodes(n)) walkTree(child, text, dx, dy);
}

/** One view node: translate offsets accumulate; targets are collected. */
function visitNode(
  node: unknown,
  n: WalkNode,
  text: string,
  dx: number,
  dy: number,
): void {
  if (n.type === "translate") {
    walkTree(n.drawable, text, dx + (n.x ?? 0), dy + (n.y ?? 0));
    return;
  }
  collectButton(node, n, text, dx, dy);
  collectTextarea(node, n as WalkNode & { eventType?: string }, dx, dy);
  walkChildren(n, text, dx, dy);
}

/** Depth-first walk over the view tree (null is the empty subtree). */
function walkTree(node: unknown, text: string, dx: number, dy: number): void {
  if (node == null) return;
  visitTree(node, text, dx, dy);
}

/** A non-null subtree: a child list or a single node. */
function visitTree(node: unknown, text: string, dx: number, dy: number): void {
  if (Array.isArray(node)) {
    for (const child of node) walkTree(child, text, dx, dy);
    return;
  }
  visitNode(node, node as WalkNode, text, dx, dy);
}

/** The drawn centre of the first button labelled `text`, in view coordinates. */
function centreOf(view: Elem, text: string): [number, number] | null {
  buttonHits.length = 0;
  textareaHits.length = 0;
  walkTree(view, text, 0, 0);
  return buttonHits[0] ?? null;
}

/** The drawn centre of the textarea (its `key-press` handler node). */
function textareaCentre(view: Elem): [number, number] | null {
  buttonHits.length = 0;
  textareaHits.length = 0;
  walkTree(view, "", 0, 0);
  return textareaHits[0] ?? null;
}

/** Pointer down+up at a drawn centre, in CLIENT pixels through the surface
 * (the mounted page's EFFECTIVE scale — fit-to-width may narrow CELL_SCALE). */
function click(page: ReviewPageHandle, at: [number, number]): void {
  const surface = page.surface.host as unknown as {
    dispatchEvent(ev: unknown): boolean;
  };
  const [cx, cy] = [at[0] * page.scale, at[1] * page.scale];
  surface.dispatchEvent(
    new (mouseCtor())("pointerdown", { clientX: cx, clientY: cy }),
  );
  surface.dispatchEvent(
    new (mouseCtor())("pointerup", { clientX: cx, clientY: cy }),
  );
}

/** One keydown through the surface (the real keyboard path). */
function typeKey(page: ReviewPageHandle, key: string): void {
  const surface = page.surface.host as unknown as {
    dispatchEvent(ev: unknown): boolean;
  };
  surface.dispatchEvent(new (keyCtor())("keydown", { key }));
}

/** One mounted page over a fresh fake-indexeddb store. */
async function mountedPage(): Promise<ReviewPageHandle> {
  return openMounted(400, 500);
}

/** One mounted page at a mobile-width container. */
async function mobilePage(): Promise<ReviewPageHandle> {
  return openMounted(300, 500);
}

async function openMounted(
  width: number,
  height: number,
): Promise<ReviewPageHandle> {
  const indexedDB = new IDBFactory();
  const port = await createReviewIndexDbPort({ indexedDB }, FIXTURE.key);
  const opened = await openTamborReview({
    port,
    key: FIXTURE.key,
    policy: FIXTURE.policy,
    catalog: FIXTURE.catalog,
    artifactId: FIXTURE.artifactId,
  });
  if (!("app" in opened)) throw new Error(opened.reason);
  const doc = hostDoc();
  const container = doc.createElement("div");
  doc.body.appendChild(container);
  return mountReviewDemo(doc as never, container as never, opened.app, [
    width,
    height,
  ]);
}

describe("review-tambor mounted page (wanna-8ay)", () => {
  it("draws the real demo into the host document", async () => {
    const page = await mountedPage();
    expect(hostDoc().body.textContent).toContain("tambor review");
    expect(page.backend.root).toBeDefined();
  });

  it("routes a button click through the surface to a shell state change", async () => {
    const page = await mountedPage();
    // the initial projection: revision 0, the slider targets revision 1
    expect(page.app.getState().view.taskRevision).toBe(0);
    expect(hostDoc().body.textContent).toContain("task revision 0");

    // click Advance artifact through the mounted surface (pointer events at
    // the button's drawn centre in CLIENT pixels — the stage scales the unit
    // grid by CELL_SCALE so 1 cell renders as a readable text cell; the wire
    // divides the positions back to units before routing)
    const at = centreOf(page.app.view(), "Advance artifact");
    expect(at).not.toBeNull();
    click(page, at as [number, number]);

    // the async shell action settles, the page re-draws, the DOM shows it
    await page.settleAndRedraw();
    expect(page.app.getState().view.taskRevision).toBe(1);
    expect(hostDoc().body.textContent).toContain("task revision 1");
  });

  it("records feedback typed into the textarea through real events (wanna-6ce)", async () => {
    const page = await mountedPage();

    // click the textarea through the mounted surface (the textarea's real
    // click path: mouse-down handler → request-focus → state-backed focus)
    const at = textareaCentre(page.app.view());
    expect(at).not.toBeNull();
    click(page, at as [number, number]);

    // DOM focus wiring: the surface takes keyboard focus (activeElement
    // was BODY in the red repro)
    expect(
      (hostDoc() as unknown as { activeElement: unknown }).activeElement,
    ).toBe(page.surface.host);

    // type through real key events: the focused textarea inserts text
    for (const ch of "hello") typeKey(page, ch);
    expect(page.app.getState().draft).toBe("hello");

    // a pending review first: advance the artifact, then request a review
    // of the delivered revision (the demo's scripted first path)
    click(
      page,
      centreOf(page.app.view(), "Advance artifact") as [number, number],
    );
    await page.settleAndRedraw();
    click(
      page,
      centreOf(page.app.view(), "Request review") as [number, number],
    );
    await page.settleAndRedraw();

    // submit through the real button; the shell records the typed feedback
    click(
      page,
      centreOf(page.app.view(), "Submit feedback") as [number, number],
    );
    await page.settleAndRedraw();
    expect(
      page.app
        .getState()
        .view.completedReviews.some((r) => r.feedback === "hello"),
    ).toBe(true);
  });

  it("scales the unit grid into readable cells in the host document", async () => {
    const page = await mountedPage();
    const stage = page.stage.host as unknown as HTMLElement;
    // the stage fits the container width (never wider than it)
    expect(Number.parseFloat(stage.style.width)).toBeLessThanOrEqual(400);
    // paper ground: high-contrast ink on a light stage
    expect(stage.style.cssText).toContain("background");
    const wrapper = stage.firstElementChild as unknown as {
      style: { cssText: string };
    } | null;
    expect(wrapper?.style.cssText ?? "").toContain(
      `scale(${String(page.scale)})`,
    );
    expect(hostDoc().body.textContent).toContain("tambor review");
  });

  it("stays usable at a mobile-width container without horizontal scroll (wanna-hbm)", async () => {
    const page = await mobilePage();
    const stage = page.stage.host as unknown as HTMLElement;
    // the stage fits the 300px container: no horizontal scrolling
    expect(Number.parseFloat(stage.style.width)).toBeLessThanOrEqual(300);

    // pointer routing survives the smaller scale: the real button flow works
    click(
      page,
      centreOf(page.app.view(), "Advance artifact") as [number, number],
    );
    await page.settleAndRedraw();
    expect(page.app.getState().view.taskRevision).toBe(1);
  });
});
