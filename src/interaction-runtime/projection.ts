// Purpose: render projection for the interaction runtime
// Responsibilities: derive a presentation-shaped projection from committed state as a deep copy
// Rationale: projections are derived views — no shared references, no authority surface, no mutation channel into committed state
import type { CommittedState, RenderProjection } from "./types";

export function projectRender(state: CommittedState): RenderProjection {
  return {
    interactionId: state.interactionId,
    interactionKind: state.interactionKind,
    revision: state.interactionRevision,
    retired: state.retired,
    retiredOutcome: state.retiredOutcome,
    responses: state.responses.map((response) => ({ ...response })),
    outcomes: state.outcomes.map((record) => ({ ...record })),
  };
}
