// Purpose: per-transition guard evaluation for the interaction-patterns machine
// Responsibilities: evaluate each [[spec]] transition guard against the definition and runtime, returning precise refusals
// Rationale: guards are parameterized by the transition's subject — e.g. pattern_completion_explicit is checked against the success steps for complete_pattern and the cancellation declaration for cancel_pattern
import type {
  Check,
  PatternDefinition,
  PatternState,
  TransitionResult,
} from "./types";
import {
  conditionDeclared,
  patternCompletionExplicit,
  patternComposesPrimitives,
} from "./invariants";

export interface PatternRuntime {
  readonly recorded: readonly string[];
  readonly awaiting: string | null;
}

export interface GuardContext {
  readonly def: PatternDefinition;
  readonly registry: readonly string[];
  readonly runtime: PatternRuntime;
}

function refused(reason: string): TransitionResult {
  return { ok: false, reason };
}

function accepted(): TransitionResult {
  return { ok: true };
}

function guarded(check: Check, refusal: string): TransitionResult {
  return check.ok ? accepted() : refused(`${refusal}: ${check.reason}`);
}

function compositionHolds(ctx: GuardContext): boolean {
  return patternComposesPrimitives(ctx.def, ctx.registry).ok;
}

function guardValidate(ctx: GuardContext): TransitionResult {
  return guarded(
    patternComposesPrimitives(ctx.def, ctx.registry),
    "validate_pattern guard patterns_compose_primitives does not hold",
  );
}

function guardStart(ctx: GuardContext): TransitionResult {
  return guarded(
    patternCompletionExplicit(ctx.def),
    "start_pattern guard pattern_completion_explicit does not hold",
  );
}

function guardWait(ctx: GuardContext, arg: string | undefined): TransitionResult {
  if (arg === undefined) return refused("wait_for_contribution requires the pending contribution step id");
  if (!ctx.def.nodes.some((n) => n.id === arg)) {
    return refused(
      `wait_for_contribution guard patterns_compose_primitives does not hold: node "${arg}" is not a declared contribution step`,
    );
  }
  return accepted();
}

function guardResume(ctx: GuardContext, arg: string | undefined): TransitionResult {
  if (arg === undefined) return refused("resume_pattern requires the delivered contribution step id");
  if (ctx.runtime.awaiting !== arg) {
    return refused(
      `resume_pattern guard patterns_compose_primitives does not hold: awaited step "${ctx.runtime.awaiting}" is not the pending contribution "${arg}"`,
    );
  }
  return accepted();
}

function guardComplete(ctx: GuardContext): TransitionResult {
  if (ctx.def.successWhen.length === 0) {
    return refused(
      "complete_pattern guard pattern_completion_explicit does not hold: the pattern declares no success condition",
    );
  }
  if (ctx.runtime.recorded.length === 0) {
    return refused(
      "complete_pattern guard pattern_completion_explicit does not hold: no contribution steps have completed",
    );
  }
  const pending = ctx.def.successWhen.find((id) => !ctx.runtime.recorded.includes(id));
  if (pending !== undefined) {
    return refused(
      `complete_pattern guard pattern_completion_explicit does not hold: success step "${pending}" has not completed`,
    );
  }
  return accepted();
}

function guardPreserveUnresolved(ctx: GuardContext): TransitionResult {
  return conditionDeclared(ctx.def, "unresolved")
    ? refused(
        "preserve_unresolved_pattern guard ¬pattern_completion_explicit evaluates false: the pattern declares an unresolved completion condition",
      )
    : accepted();
}

function guardCancel(ctx: GuardContext, arg: string | undefined): TransitionResult {
  if (arg === undefined) return refused("cancel_pattern requires a cancellation reason");
  return conditionDeclared(ctx.def, "cancellation") && ctx.def.cancellable === true
    ? accepted()
    : refused(
        "cancel_pattern guard pattern_completion_explicit does not hold: the pattern does not declare a cancellation completion condition",
      );
}

function failBlockers(ctx: GuardContext): readonly string[] {
  const blockers: string[] = [];
  if (patternCompletionExplicit(ctx.def).ok) blockers.push("pattern_completion_explicit");
  if (compositionHolds(ctx)) blockers.push("patterns_compose_primitives");
  return blockers;
}

function guardFail(ctx: GuardContext, arg: string | undefined): TransitionResult {
  if (arg === undefined) return refused("fail_pattern requires failure detail");
  const blockers = failBlockers(ctx);
  if (blockers.length > 0) {
    const holds = blockers.map((b) => `${b} holds`).join(" ∧ ");
    return refused(
      `fail_pattern guard ¬(pattern_completion_explicit ∨ patterns_compose_primitives) evaluates false: ${holds}`,
    );
  }
  return accepted();
}

export function guardFor(ctx: GuardContext, id: string, arg: string | undefined): TransitionResult {
  switch (id) {
    case "validate_pattern": return guardValidate(ctx);
    case "start_pattern": return guardStart(ctx);
    case "wait_for_contribution": return guardWait(ctx, arg);
    case "resume_pattern": return guardResume(ctx, arg);
    case "complete_pattern": return guardComplete(ctx);
    case "preserve_unresolved_pattern": return guardPreserveUnresolved(ctx);
    case "cancel_pattern": return guardCancel(ctx, arg);
    case "fail_pattern": return guardFail(ctx, arg);
    default: return refused(`unknown transition ${id}`);
  }
}

export function reviseStateAllowed(state: PatternState): boolean {
  return state === "running" || state === "waiting";
}
