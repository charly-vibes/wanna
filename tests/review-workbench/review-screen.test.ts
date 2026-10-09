// Purpose: consumer tests for the minimal revision-7 review screen (wanna-01q)
// Responsibilities: prove the browser first path — artifact identity/revision/content/request visible, feedback accepted only through the public shell, recorded outcome shown tied to revision 7; reviewer controls stay semantic, keyboard-operable and authorization-free
// Rationale: [[review.workbench.review_revision_visible]] — first usable consumer path over the public barrel and the durable adapter; final recovery acceptance stays open in wanna-9r2
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { IDBFactory } from "fake-indexeddb";
import { createReviewIndexDbPort } from "../../src/review-workbench/adapters/review-indexeddb";
import {
  scriptedRevision7Fixture,
  startReviewWorkbench,
  type ReviewScreenHandle,
} from "../../examples/review-workbench";

function text(root: ParentNode, selector: string): string {
  const el = root.querySelector(selector);
  expect(el, `missing element ${selector}`).not.toBeNull();
  return (el as HTMLElement).textContent?.trim() ?? "";
}

async function renderScreen(): Promise<ReviewScreenHandle> {
  const fixture = scriptedRevision7Fixture();
  const port = await createReviewIndexDbPort(
    { indexedDB: new IDBFactory() },
    fixture.key,
  );
  return startReviewWorkbench({ document, port, fixture });
}

describe("review workbench screen: first path", () => {
  it("review revision visible", async () => {
    const { root, shell } = await renderScreen();
    expect(shell, "first path mounts a live shell").not.toBeNull();

    // identity, revision, content and request come from the shell projection /
    // host-owned fixture and are visible before any input
    expect(text(root, "[data-field=artifact-identity]")).toBe("artifact-1");
    expect(text(root, "[data-field=artifact-revision]")).toBe("7");
    expect(text(root, "[data-field=artifact-content]")).toContain("revision 7");
    expect(text(root, "[data-field=review-request]")).toContain("review");

    // feedback entry is a labeled, keyboard-operable control
    const feedback = root.querySelector("textarea#review-feedback");
    expect(feedback, "feedback textarea present").not.toBeNull();
    const label = root.querySelector('label[for="review-feedback"]');
    expect(label?.textContent ?? "").toMatch(/feedback/i);

    // the reviewer submits and the recorded outcome is shown tied to revision 7
    (feedback as HTMLTextAreaElement).value = "Needs one concrete example.";
    const submit = root.querySelector<HTMLButtonElement>("button[type=submit]");
    expect(submit, "submit control present").not.toBeNull();
    submit!.click();
    await vi.waitFor(() => {
      const status = text(root, "[role=status]");
      expect(status).toContain("recorded");
      expect(status).toContain("revision 7");
      expect(status).toContain("Needs one concrete example.");
    });

    // committed state agrees with what the screen showed (asserted as visible
    // results AND committed state per the design's end-to-end rule)
    expect(shell!.project().completedReviews).toEqual([
      expect.objectContaining({
        revision: 7,
        feedback: "Needs one concrete example.",
      }),
    ]);

    // no authorization or external action is offered or implied
    const controls = [...root.querySelectorAll("button, a")].map(
      (b) => b.textContent ?? "",
    );
    for (const controlLabel of controls) {
      expect(controlLabel.toLowerCase()).not.toMatch(
        /approv|authoriz|execute|publish|deploy|send/,
      );
    }
  });

  it("consumer uses public surface", () => {
    // static dependency check: the workbench example imports only the shell
    // public barrel, the adapter public entry, its own modules — never shell or
    // adapter layer internals ([[review.workbench.consumer_boundary]])
    const allowed = new Set([
      "@wanna/composition-shell",
      "@wanna/review-indexeddb",
    ]);
    const dir = join(import.meta.dirname, "..", "..", "examples", "review-workbench");
    const headlessDir = join(import.meta.dirname, "..", "..", "examples", "review-headless");
    for (const [label, scanDir] of [
      ["review-workbench", dir],
      ["review-headless", headlessDir],
    ] as const) {
    for (const file of readdirSync(scanDir).filter((n) => n.endsWith(".ts"))) {
      const source = readFileSync(join(scanDir, file), "utf8");
      const specifiers = [...source.matchAll(/from\s+["']([^"'"]+)["']/g)].map((m) => m[1]!);
      for (const spec of specifiers) {
        if (spec.startsWith(".")) continue; // intra-example module
        expect(
          allowed.has(spec),
          `${label}/${file} imports non-public module ${spec}`,
        ).toBe(true);
      }
    }
    }
  });
});