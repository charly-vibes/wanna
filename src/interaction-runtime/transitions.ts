// Purpose: the eight [[spec]] model transitions for the interaction runtime
// Responsibilities: each transition's from-state check, guard evaluation, and effect — validate, reject-malformed, apply, reject-stale, continue, retry-corrected, retry-refreshed, retire
// Rationale: guards fail with precise reasons so rejections are typed and testable, never generic
import type { EventEnvelope, InteractionKind, RuntimeState, TransitionId, TransitionResult } from "./types";
import { LIFECYCLE_PERMISSIONS } from "./types";
import { envelopeValid } from "./envelope";
import { commitPreconditionsSatisfied } from "./preconditions";
import { isLifecycle, reduceEvent } from "./reducer";
import { persist, unknownBlockReason } from "./failure";
import type { Internals } from "./internals";
import { guardFailed, requireFrom } from "./internals";

function fireValidate(internals: Internals, event?: EventEnvelope): TransitionResult {
  const wrong = requireFrom(internals, "validate_envelope", "active");
  if (wrong) return wrong;
  const check = envelopeValid(event);
  if (!check.ok) return guardFailed("event_envelope_valid", check.reason);
  internals.pendingEvent = event ?? null;
  internals.state = "validated";
  return { ok: true };
}

function fireRejectMalformed(internals: Internals, event?: EventEnvelope): TransitionResult {
  const wrong = requireFrom(internals, "reject_malformed_envelope", "active");
  if (wrong) return wrong;
  const check = envelopeValid(event);
  if (check.ok) {
    return { ok: false, reason: "guard ¬event_envelope_valid does not hold: the event envelope is valid" };
  }
  internals.malformedReason = check.reason;
  internals.state = "malformed_event";
  return { ok: true };
}

function commitNext(internals: Internals, event: EventEnvelope, to: RuntimeState): TransitionResult {
  if (internals.unknownEffect) return { ok: false, reason: unknownBlockReason(internals.unknownEffect) };
  const reduction = reduceEvent(internals.committed, event);
  if (!reduction.ok) return { ok: false, reason: reduction.reason };
  const failure = persist(internals.port, internals.committed, reduction.next, event);
  if (failure) {
    internals.lastFailure = failure;
    if (failure.effectCertainty === "unknown") internals.unknownEffect = failure;
    return { ok: false, reason: `${failure.code}: ${failure.detail}` };
  }
  internals.committed = reduction.next;
  internals.lastFailure = null;
  internals.state = to;
  return { ok: true };
}

function fireApply(internals: Internals): TransitionResult {
  const wrong = requireFrom(internals, "apply_current_event", "validated");
  if (wrong) return wrong;
  const event = internals.pendingEvent;
  if (!event) return guardFailed("event_commit_preconditions_satisfied", "no validated event is pending");
  if (isLifecycle(event.eventType)) {
    return guardFailed(
      "event_commit_preconditions_satisfied",
      `${event.eventType} is a lifecycle event — it retires via retire_interaction, not apply_current_event`,
    );
  }
  const preconditions = commitPreconditionsSatisfied(internals.committed, event);
  if (!preconditions.ok) return guardFailed("event_commit_preconditions_satisfied", preconditions.reason);
  return commitNext(internals, event, "applied");
}

function fireRejectStale(internals: Internals): TransitionResult {
  const wrong = requireFrom(internals, "reject_stale_or_duplicate", "validated");
  if (wrong) return wrong;
  const event = internals.pendingEvent;
  if (!event) {
    return { ok: false, reason: "guard ¬event_commit_preconditions_satisfied does not hold: no validated event is pending" };
  }
  const preconditions = commitPreconditionsSatisfied(internals.committed, event);
  if (preconditions.ok) {
    return { ok: false, reason: "guard ¬event_commit_preconditions_satisfied does not hold: the commit preconditions are satisfied" };
  }
  internals.rejectionReason = preconditions.reason;
  internals.state = "rejected_commit";
  return { ok: true };
}

function fireContinue(internals: Internals): TransitionResult {
  const wrong = requireFrom(internals, "continue_after_apply", "applied");
  if (wrong) return wrong;
  if (!internals.pendingNext && !internals.pollRequested) {
    return guardFailed("next_event_received", "no next event or poll request has arrived");
  }
  internals.pendingNext = false;
  internals.pollRequested = false;
  internals.state = "active";
  return { ok: true };
}

function fireRetryCorrected(internals: Internals, event?: EventEnvelope): TransitionResult {
  const wrong = requireFrom(internals, "retry_with_corrected_event", "malformed_event");
  if (wrong) return wrong;
  const check = envelopeValid(event);
  if (!check.ok) {
    internals.malformedReason = check.reason;
    return guardFailed("event_envelope_valid", check.reason);
  }
  internals.pendingEvent = event ?? null;
  internals.malformedReason = null;
  internals.state = "active";
  return { ok: true };
}

function fireRetryRefreshed(internals: Internals): TransitionResult {
  const wrong = requireFrom(internals, "retry_after_state_refresh", "rejected_commit");
  if (wrong) return wrong;
  if (!internals.snapshotReceived) {
    return guardFailed("state_refresh_received", "no refreshed committed-state snapshot has been received");
  }
  if (internals.refreshedState) internals.committed = internals.refreshedState;
  internals.snapshotReceived = false;
  internals.refreshedState = null;
  internals.rejectionReason = null;
  internals.state = "active";
  return { ok: true };
}

function permittedLifecycle(kind: InteractionKind, eventType: string): boolean {
  return (LIFECYCLE_PERMISSIONS[kind] as readonly string[]).includes(eventType);
}

function retireGuard(internals: Internals, event: EventEnvelope): TransitionResult | null {
  const envelope = envelopeValid(event);
  if (!envelope.ok) return guardFailed("retirement_requested", envelope.reason);
  if (!isLifecycle(event.eventType)) {
    return guardFailed("retirement_requested", `${event.eventType} is not a lifecycle event`);
  }
  const kind = internals.committed.interactionKind;
  if (!permittedLifecycle(kind, event.eventType)) {
    return guardFailed("retirement_requested", `${event.eventType} is not a permitted lifecycle event for interaction kind ${kind}`);
  }
  const preconditions = commitPreconditionsSatisfied(internals.committed, event);
  if (!preconditions.ok) return guardFailed("retirement_requested", preconditions.reason);
  return null;
}

function fireRetire(internals: Internals, event?: EventEnvelope): TransitionResult {
  const wrong = requireFrom(internals, "retire_interaction", "active");
  if (wrong) return wrong;
  if (!event) return guardFailed("retirement_requested", "no lifecycle event supplied");
  const guard = retireGuard(internals, event);
  if (guard) return guard;
  return commitNext(internals, event, "retired");
}

export function fireTransition(internals: Internals, id: TransitionId, event?: EventEnvelope): TransitionResult {
  switch (id) {
    case "validate_envelope": return fireValidate(internals, event);
    case "reject_malformed_envelope": return fireRejectMalformed(internals, event);
    case "apply_current_event": return fireApply(internals);
    case "reject_stale_or_duplicate": return fireRejectStale(internals);
    case "continue_after_apply": return fireContinue(internals);
    case "retry_with_corrected_event": return fireRetryCorrected(internals, event);
    case "retry_after_state_refresh": return fireRetryRefreshed(internals);
    case "retire_interaction": return fireRetire(internals, event);
  }}
