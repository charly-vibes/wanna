// Purpose: the browser entry for the gh-pages review-tambor demo (wanna-8ay) —
//   the composition shell's review session rendered through tambor widgets
// Responsibilities: open the real shell over the durable IndexedDB adapter
//   (the browser's own indexedDB), mount the demo through the page glue, and
//   surface a readable failure when IndexedDB is unavailable; a scripted
//   first path (advance to revision 7, request its review) seeds the session
//   so the page opens on a pending review, matching the workbench consumer
// Rationale: option A — the demo is wanna-owned and deployed under
//   https://charly-vibes.github.io/wanna/; the shell semantics stay in the
//   barrel and examples/review-tambor, this entry is plumbing only. The page
//   persists in IndexedDB, so a reload resumes the same session (restart
//   durability, visible in the browser).
import { createReviewIndexDbPort } from "../../src/review-workbench/adapters/review-indexeddb";
import { openTamborReview } from "../../examples/review-tambor";
import { mountReviewDemo } from "./mount";

const KEY = { sessionId: "page-demo", taskId: "artifact-1" } as const;

/** The demo viewport, measured from the host (wanna-hbm): the mount scales
 * the widget stack to fit this width, so a mobile viewport stays usable. */
function viewport(): readonly [number, number] {
  const w = globalThis.innerWidth ?? 400;
  return [w - 48, globalThis.innerHeight ?? 800];
}

/** Write a plain-message failure into the container. */
function fail(container: HTMLElement, message: string): void {
  container.textContent = message;
}

/** Open the shell over the browser's IndexedDB adapter. */
async function openShell(): Promise<
  Parameters<typeof mountReviewDemo>[2] | { failure: string }
> {
  if (!globalThis.indexedDB) {
    return {
      failure:
        "This demo needs IndexedDB — serve the page over http(s), not file://",
    };
  }
  const port = await createReviewIndexDbPort(
    { indexedDB: globalThis.indexedDB },
    KEY,
  );
  const opened = await openTamborReview({
    port,
    key: KEY,
    policy: { policyVersion: "page-demo-policy-1" },
    catalog: { catalogVersion: "page-demo-catalog-1" },
    artifactId: KEY.taskId,
  });
  if (!("app" in opened)) {
    return {
      failure: `The shell refused to open the session: ${opened.kind} — ${opened.reason}`,
    };
  }
  return opened.app;
}

/** The scripted first path: revision 7 exists, its review is pending. */
async function seedFirstPath(
  app: Parameters<typeof mountReviewDemo>[2],
): Promise<void> {
  app.dispatch([["demo-advance", 7, "artifact-1/revisions/7"]]);
  await app.settle();
  app.dispatch([["demo-request", 7]]);
  await app.settle();
}

async function boot(): Promise<void> {
  const container = document.getElementById("app") ?? document.body;
  const opened = await openShell();
  if ("failure" in opened) {
    fail(container, opened.failure);
    return;
  }
  await seedFirstPath(opened);
  const header = container.ownerDocument.createElement("p");
  header.textContent =
    "The composition shell's review session, mounted through tambor's widgets. " +
    "Every button routes through the real shell — reload to see restart durability.";
  container.appendChild(header);
  mountReviewDemo(
    container.ownerDocument as never,
    container as never,
    opened,
    viewport(),
  );
}

void boot().catch((e: unknown) => {
  const container = document.getElementById("app") ?? document.body;
  const reason = e instanceof Error ? e.message : String(e);
  container.textContent = `The demo failed to boot: ${reason}`;
});
