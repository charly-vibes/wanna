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
  CELL_SCALE,
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

/** Record the drawn centre of a matching button. */
function collectButton(node: unknown, n: WalkNode, text: string, dx: number, dy: number, hits: [number, number][]): void {
  if (n.type === "button" && n.text === text) {
    const [w, h] = bounds(node as Elem);
    hits.push([dx + w / 2, dy + h / 2]);
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
function walkChildren(n: WalkNode, text: string, dx: number, dy: number, hits: [number, number][]): void {
  for (const child of childNodes(n)) walkTree(child, text, dx, dy, hits);
}

/** One view node: translate offsets accumulate; buttons are collected. */
function visitNode(node: unknown, n: WalkNode, text: string, dx: number, dy: number, hits: [number, number][]): void {
  if (n.type === "translate") {
    walkTree(n.drawable, text, dx + (n.x ?? 0), dy + (n.y ?? 0), hits);
    return;
  }
  collectButton(node, n, text, dx, dy, hits);
  walkChildren(n, text, dx, dy, hits);
}

/** Depth-first walk over the view tree (null is the empty subtree). */
function walkTree(node: unknown, text: string, dx: number, dy: number, hits: [number, number][]): void {
  if (node == null) return;
  visitTree(node, text, dx, dy, hits);
}

/** A non-null subtree: a child list or a single node. */
function visitTree(node: unknown, text: string, dx: number, dy: number, hits: [number, number][]): void {
  if (Array.isArray(node)) {
    for (const child of node) walkTree(child, text, dx, dy, hits);
    return;
  }
  visitNode(node, node as WalkNode, text, dx, dy, hits);
}

/** The drawn centre of the first button labelled `text`, in view coordinates. */
function centreOf(view: Elem, text: string): [number, number] | null {
  const hits: [number, number][] = [];
  walkTree(view, text, 0, 0, hits);
  return hits[0] ?? null;
}

/** One mounted page over a fresh fake-indexeddb store. */
async function mountedPage(): Promise<ReviewPageHandle> {
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
  return mountReviewDemo(doc as never, container as never, opened.app, [400, 500]);
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
    const [ux, uy] = at as [number, number];
    const cx = ux * CELL_SCALE;
    const cy = uy * CELL_SCALE;
    const surface = page.surface.host as unknown as {
      dispatchEvent(ev: unknown): boolean;
    };
    surface.dispatchEvent(new (mouseCtor())("pointerdown", { clientX: cx, clientY: cy }));
    surface.dispatchEvent(new (mouseCtor())("pointerup", { clientX: cx, clientY: cy }));

    // the async shell action settles, the page re-draws, the DOM shows it
    await page.settleAndRedraw();
    expect(page.app.getState().view.taskRevision).toBe(1);
    expect(hostDoc().body.textContent).toContain("task revision 1");
  });

  it("scales the unit grid into readable cells in the host document", async () => {
    const page = await mountedPage();
    const stage = page.stage.host as unknown as HTMLElement;
    // the stage reserves the scaled footprint; the wrapper carries the transform
    expect(stage.style.cssText).toContain("960px");
    // paper ground: high-contrast ink on a light stage
    expect(stage.style.cssText).toContain("background");
    const wrapper = stage.firstElementChild as unknown as {
      style: { cssText: string };
    } | null;
    expect(wrapper?.style.cssText ?? "").toContain(`scale(${String(CELL_SCALE)})`);
    expect(hostDoc().body.textContent).toContain("tambor review");
  });
});
