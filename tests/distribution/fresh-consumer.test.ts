// Purpose: fresh-consumer distribution verification (add-shell-distribution 1.1)
// Responsibilities: prove the emitted @charly-vibes/wanna artifact imports,
// typechecks and runs the demonstrated consumer scenario outside the repository
// aliases, with no access to src/ and no ambient types beyond the consumer's own
// Rationale: openspec/changes/add-shell-distribution — scenarios
// fresh-consumer-imports-entry and declarations-typecheck-standalone; the test
// invokes the emission step itself so a clean checkout fails only when the
// build is genuinely broken. RED first: no emission exists yet.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, it } from "vitest";

const REPO = path.resolve(import.meta.dirname, "../..");
const DIST = path.join(REPO, "dist");

/**
 * The emission step (task 2.1 owns the script). RED state: the script and
 * dist/ are absent, so this throws and both scenarios fail naming the cause.
 */
function emitArtifact(): void {
  try {
    execFileSync("npm", ["run", "build:dist"], {
      cwd: REPO,
      stdio: "pipe",
      encoding: "utf8",
    });
  } catch (error) {
    throw new Error(
      "distribution emission missing: build:dist script absent or failed (dist/ not produced)",
      { cause: error },
    );
  }
  mkdirSync(DIST, { recursive: true });
}

/**
 * A minimal consumer outside the repository aliases: its own temp project with
 * a bare `@charly-vibes/wanna` import resolved from the emitted artifact via a
 * node_modules symlink — the repo tsconfig paths and src/ are not involved. The consumer installs no ambient types beyond its own `log`
 * declaration, so any test-global or @types/node leakage into the emitted
 * declarations breaks the compile.
 */
const CONSUMER_SOURCE = `import type {
  PortCommitOutcome,
  PortLoadOutcome,
  PortOperation,
  PortReconcileOutcome,
  ReviewPersistencePort,
  SessionTaskKey,
} from "@charly-vibes/wanna";
import { openReviewSession } from "@charly-vibes/wanna";

/** Consumer-owned in-memory persistence port (the shell owns the coordination). */
class MemoryPort implements ReviewPersistencePort {
  readonly supportsAtomicCommitAndReplay = true;
  private version = 0;
  private taskRevision = 0;
  private readonly replay: unknown[] = [];
  private readonly receipts = new Map<string, { operationId: string; applied: boolean }>();

  constructor(private readonly key: SessionTaskKey) {}

  get deduplicationScope(): ReadonlySet<string> {
    return new Set([this.key.sessionId]);
  }

  async load(): Promise<PortLoadOutcome> {
    if (this.version === 0) return { kind: "not_found" };
    return {
      kind: "loaded",
      snapshot: {
        aggregateVersion: this.version,
        taskRevision: this.taskRevision,
        replay: [...this.replay],
        receipts: [...this.receipts.values()],
      },
    };
  }

  async compareAndCommit(
    _key: SessionTaskKey,
    expectedVersion: number | null,
    operation: PortOperation,
  ): Promise<PortCommitOutcome> {
    const receipt = this.receipts.get(operation.operationId);
    if (receipt) return { kind: "duplicate", receipt };
    const precondition = expectedVersion === null
      ? this.version === 0
      : this.version === expectedVersion;
    if (!precondition) return { kind: "conflict" };
    this.apply(operation);
    return {
      kind: "applied",
      receipt: this.receipts.get(operation.operationId)!,
      snapshot: {
        aggregateVersion: this.version,
        taskRevision: this.taskRevision,
        replay: [...this.replay],
        receipts: [...this.receipts.values()],
      },
    };
  }

  async reconcile(
    _key: SessionTaskKey,
    operationId: string,
  ): Promise<PortReconcileOutcome> {
    const receipt = this.receipts.get(operationId);
    if (receipt && receipt.applied) return { kind: "applied", receipt, snapshot: {
      aggregateVersion: this.version,
      taskRevision: this.taskRevision,
      replay: [...this.replay],
      receipts: [...this.receipts.values()],
    } };
    return { kind: "not_applied" };
  }

  private apply(operation: PortOperation): void {
    const changes = operation.stateChanges as Record<string, unknown> | null;
    const revision = changes !== null && typeof changes === "object"
      ? changes["taskRevision"] ?? changes["revision"]
      : undefined;
    if (typeof revision === "number" && Number.isFinite(revision)) {
      this.taskRevision = revision;
    }
    this.version += 1;
    this.replay.push(
      { operationId: operation.operationId, stateChanges: operation.stateChanges },
      ...operation.replayAdditions,
    );
    this.receipts.set(operation.operationId, {
      operationId: operation.operationId,
      applied: true,
    });
  }
}

async function main(): Promise<void> {
  const key: SessionTaskKey = { sessionId: "fresh-consumer", taskId: "artifact-1" };
  const opened = await openReviewSession({
    key,
    policy: { policyVersion: "fresh-policy-1" },
    catalog: { catalogVersion: "fresh-catalog-1" },
    port: new MemoryPort(key),
  });
  if (opened.kind !== "ready") {
    throw new Error("FRESH-CONSUMER-FAIL open " + opened.kind);
  }
  const shell = opened.shell;
  const advanced = await shell.updateArtifact({
    operationId: "artifact-7",
    expectedAggregateVersion: null,
    revision: 7,
    contentRef: "artifact-1/revisions/7",
  });
  if (advanced.kind !== "applied") {
    throw new Error("FRESH-CONSUMER-FAIL updateArtifact " + advanced.kind);
  }
  const decision = await shell.evaluateNeed({
    kind: "review_artifact",
    target: "artifact-1",
    taskRevision: 7,
    proposalId: "proposal-7",
    evidenceRefs: ["revisions/7"],
    evidenceStrength: "sufficient",
  });
  if (decision.kind !== "decided") {
    throw new Error("FRESH-CONSUMER-FAIL evaluateNeed " + decision.kind);
  }
  const committed = await shell.commitDecision({
    operationId: "create-review-7",
    decisionId: decision.id,
  });
  if (committed.kind !== "committed") {
    throw new Error("FRESH-CONSUMER-FAIL commitDecision " + committed.kind);
  }
  const projected = shell.project();
  const outcome = await shell.submit({
    eventId: "feedback-1",
    interactionId: projected.interactionId,
    expectedTaskRevision: 7,
    expectedInteractionRevision: projected.interactionRevision,
    feedback: "looks good",
  });
  if (outcome.kind !== "recorded") {
    throw new Error("FRESH-CONSUMER-FAIL submit " + outcome.kind);
  }
  const completed = shell.project().completedReviews.at(-1);
  if (completed === undefined || completed.revision !== 7) {
    throw new Error("FRESH-CONSUMER-FAIL recorded revision " + String(completed?.revision));
  }
}

void main();
`;

const CONSUMER_TSCONFIG = {
  compilerOptions: {
    target: "ES2022",
    module: "ESNext",
    moduleResolution: "bundler",
    strict: true,
    noUncheckedIndexedAccess: true,
    types: [],
    lib: ["ES2022"],
    outDir: "./out",
  },
  include: ["consumer.ts"],
} as const;

/** Consumer project layout; node_modules symlink resolves the bare import to the artifact. */
function writeConsumerProject(dir: string): string {
  writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "fresh-consumer", private: true, type: "module" }, null, 2),
  );
  writeFileSync(path.join(dir, "consumer.ts"), CONSUMER_SOURCE);
  writeFileSync(
    path.join(dir, "tsconfig.json"),
    JSON.stringify(CONSUMER_TSCONFIG, null, 2),
  );
  mkdirSync(path.join(dir, "node_modules/@charly-vibes"), { recursive: true });
  symlinkSync(DIST, path.join(dir, "node_modules/@charly-vibes/wanna"), "dir");
  return dir;
}

describe("fresh consumer outside the repository aliases (add-shell-distribution)", () => {
  let consumerDir: string;

  beforeAll(() => {
    emitArtifact();
    consumerDir = writeConsumerProject(mkdtempSync(path.join(tmpdir(), "fresh-consumer-")));
  });

  it("declarations typecheck standalone (declarations-typecheck-standalone)", () => {
    execFileSync(
      path.join(REPO, "node_modules/.bin/tsc"),
      ["-p", path.join(consumerDir, "tsconfig.json")],
      { stdio: "pipe", encoding: "utf8" },
    );
    // tsc exit 0 is the assertion; a leaked test global or node type fails here
  });

  it("fresh consumer imports the entry and records the review (fresh-consumer-imports-entry)", () => {
    try {
      execFileSync(
        process.execPath,
        [path.join(consumerDir, "out/consumer.js")],
        { stdio: "pipe", encoding: "utf8", cwd: consumerDir },
      );
    } catch (error) {
      const stderr = (error as { stderr?: Buffer }).stderr?.toString() ?? "";
      throw new Error("fresh consumer run failed:\n" + stderr, { cause: error });
    }
    // exit 0 after open → advance(7) → evaluate → commit → submit → recorded(7)
  });
});
