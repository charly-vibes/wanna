// Purpose: presentation affordances for the host adapter layer
// Responsibilities: the pure presentation handle — focus, enable, hide — with no authority API
// Rationale: [[spec.visual_render_has_no_authority]] — showing, focusing, hiding, or enabling a
//   control never authorizes an action or mutates domain/process state; the handle is inert data
export interface ControlSpec {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
}

export interface PresentationHandle {
  readonly renderKind: string;
  readonly controls: readonly ControlSpec[];
  focus(id: string): void;
  enable(id: string): void;
  hide(): void;
  isFocused(id: string): boolean;
  isEnabled(id: string): boolean;
  hidden(): boolean;
}

interface HandleState {
  focused: string | null;
  enabledIds: Set<string>;
  hidden: boolean;
}

export function createPresentationHandle(renderKind: string, controls: readonly ControlSpec[]): PresentationHandle {
  const state: HandleState = { focused: null, enabledIds: new Set(), hidden: false };
  return {
    renderKind,
    controls,
    focus: (id) => {
      state.focused = id;
    },
    enable: (id) => {
      state.enabledIds.add(id);
    },
    hide: () => {
      state.hidden = true;
    },
    isFocused: (id) => state.focused === id,
    isEnabled: (id) => state.enabledIds.has(id),
    hidden: () => state.hidden,
  };
}

/** Builds the control set for a contract: one control per option, or a single respond control. */
export function controlsFor(contract: { readonly payload: Readonly<Record<string, unknown>> }): readonly ControlSpec[] {
  const options = contract.payload["options"];
  if (!Array.isArray(options) || options.length === 0) {
    return [{ id: "respond", label: "respond", enabled: true }];
  }
  return options.map((option) => {
    const record = (option ?? {}) as Partial<Record<string, unknown>>;
    return {
      id: typeof record["id"] === "string" ? record["id"] : "respond",
      label: typeof record["value"] === "string" ? record["value"] : "respond",
      enabled: true,
    };
  });
}