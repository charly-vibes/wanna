// Purpose: test fixtures for the continuity-contract machine
// Responsibilities: build canonical valid tasks, checkpoint scopes, resume contexts, and handoff records
// Rationale: single source of shared continuity vocabulary for transitions and properties tests
import type {
  CheckpointScope,
  ContinuityTask,
  HandoffRecord,
  ResumeContext,
  SuspendPolicy,
  ValidatedInput,
} from "../../src/continuity-contract/types";

export function validatedDraft(overrides: Partial<ValidatedInput> = {}): ValidatedInput {
  return { content: "draft: summarize the incident timeline", validated: true, ...overrides };
}

export function validTask(overrides: Partial<ContinuityTask> = {}): ContinuityTask {
  return {
    taskRevision: "task-7",
    goal: "ship the incident summary to the on-call rotation",
    lastConfirmedState: "timeline drafted and reviewed against ev-1",
    completed: ["collect timeline facts", "draft summary"],
    pending: ["review summary", "send summary"],
    pendingActions: [{ actionId: "act-1", preparedAgainstRevision: "task-7" }],
    validatedDraft: validatedDraft(),
    ephemera: {
      scrollPosition: 42,
      cursorLocation: "line 12",
      openPanel: "timeline",
      hostFocus: "editor",
    },
    ...overrides,
  };
}

export function validScope(overrides: Partial<CheckpointScope> = {}): CheckpointScope {
  return {
    persistedData: ["timeline-facts@task-7"],
    uncommittedDrafts: ["draft/summary"],
    activeInteractions: ["review with reviewer@oncall"],
    pendingEffects: ["send-summary-email"],
    evidenceRefs: ["ev-1", "ev-2"],
    excludedEphemera: ["scroll position", "cursor location", "open panel", "host focus"],
    ...overrides,
  };
}

export function suspendPolicy(overrides: Partial<SuspendPolicy> = {}): SuspendPolicy {
  return { ...overrides };
}

export function validResumeContext(overrides: Partial<ResumeContext> = {}): ResumeContext {
  return {
    priorGoal: "ship the incident summary to the on-call rotation",
    lastConfirmedState: "timeline drafted and reviewed against ev-1",
    completed: ["collect timeline facts", "draft summary"],
    pending: ["review summary", "send summary"],
    changedSinceSuspension: [],
    unresolvedFailures: [],
    nextAction: "review the summary draft",
    ...overrides,
  };
}

export function validHandoffRecord(overrides: Partial<HandoffRecord> = {}): HandoffRecord {
  return {
    currentOwner: "human:desk",
    newOwner: "agent:claude",
    authorityScope: ["edit summary", "send summary"],
    pendingDecisions: ["choose the recipients"],
    unresolvedRisks: ["timeline may be incomplete"],
    evidenceRefs: ["ev-1", "ev-2"],
    ...overrides,
  };
}
