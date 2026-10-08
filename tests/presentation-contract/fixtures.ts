// Purpose: test fixtures for the presentation-contract layer
// Responsibilities: build canonical valid drafts and the host render/fallback requests the corpus properties name
// Rationale: single source of shared presentation vocabulary for transitions and properties tests
import type {
  HostRenderRequest,
  PresentationContract,
  RenderedAction,
} from "../../src/presentation-contract/types";

export function validDraft(overrides: Partial<PresentationContract> = {}): PresentationContract {
  return {
    role: "choose",
    primaryTask: "pick the deployment target for this change",
    supportingContext: ["two environments are configured"],
    optionalDetail: ["rollout history is available"],
    actions: [
      {
        id: "choose-target",
        meaning: "select one deployment target",
        responseSchema: [{ name: "target", type: "string" }],
      },
    ],
    components: ["choice-list", "action-bar"],
    texts: ["the assistant cannot proceed without a target"],
    density: "compact",
    ...overrides,
  };
}

export function renderedFor(draft: PresentationContract): RenderedAction[] {
  return (draft.actions ?? []).map((a) => ({
    actionId: a.id,
    meaning: a.meaning,
    responseSchema: a.responseSchema.map((f) => ({ ...f })),
  }));
}

export function renderRequestFor(draft: PresentationContract): HostRenderRequest {
  return { actions: renderedFor(draft) };
}