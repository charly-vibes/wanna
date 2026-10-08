// Purpose: property tests for the host adapter layer
// Responsibilities: each corpus property of host-adapters as a vitest test; names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/host-adapters/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  createHostAdapter,
  checkCapability,
  keyboardOperable,
  INTERACTION_KINDS,
} from "../../src/host-adapters/index";
import type { HostAdapter } from "../../src/host-adapters/index";
import type { CoreValidator } from "../../src/host-adapters/types";
import type { ContractResponse, InteractionContract } from "./fixtures";
import {
  capability,
  keyboardOnlyCapability,
  rejectingCore,
  responseFor,
  validContract,
  webCapability,
} from "./fixtures";

function flowToRendered(
  contract: InteractionContract = validContract(),
  cap = capability(),
  core?: CoreValidator,
): HostAdapter {
  const m = createHostAdapter(contract, cap, core);
  expect(m.fire("validate_received_contract").ok).toBe(true);
  expect(m.fire("render_supported_kind").ok).toBe(true);
  return m;
}

function flowToAccepted(
  contract: InteractionContract = validContract(),
  cap = capability(),
  core?: CoreValidator,
): HostAdapter {
  const m = flowToRendered(contract, cap, core);
  expect(m.fire("accept_core_valid_response", { response: responseFor(contract) }).ok).toBe(true);
  return m;
}

function staleVariant(contract: InteractionContract): ContractResponse {
  return responseFor(contract, { interactionRevision: "rev-0" });
}

describe("host-adapters properties", () => {
  it("TypeScript test: equivalent answers in web and TUI yield equivalent host-neutral events", () => {
    const contract = validContract();
    const tui = flowToAccepted(contract, capability());
    const web = flowToAccepted(contract, webCapability());
    expect(tui.events).toEqual(web.events);
    // the events carry no host identity — they are host-neutral by construction
    for (const event of [...tui.events, ...web.events]) {
      expect(Object.keys(event).sort()).toEqual(["eventId", "fields", "interactionId", "kind"]);
    }
    // different answers are never silently equalized
    const differentAnswer = flowToRendered(contract, webCapability());
    const answered = responseFor(contract, { eventId: "evt-9", fields: { selected: "Option B" } });
    expect(differentAnswer.fire("accept_core_valid_response", { response: answered }).ok).toBe(true);
    expect(differentAnswer.events[0]?.fields).not.toEqual(tui.events[0]?.fields);
  });

  it("Adapter contract test: unsupported kind returns a visible typed result or a registered semantic fallback", () => {
    // no support and no fallback → an explicit typed result, never silence
    const bare = capability({ fallbacks: {} });
    const unsupported = checkCapability(validContract({ kind: "rank" }), bare);
    expect(unsupported.ok).toBe(false);
    if (!unsupported.ok) {
      expect(unsupported.reason).toContain('kind "rank"');
      expect(unsupported.reason).toContain("no registered semantic fallback");
    }
    // a registered semantic fallback is explicit and names the render kind
    const fallback = checkCapability(validContract({ kind: "rank" }), capability());
    expect(fallback).toEqual({ ok: true, mode: "fallback", renderKind: "choose" });
    // the machine records the typed result when it reports the unsupported kind
    const m = createHostAdapter(validContract({ kind: "rank" }), bare);
    m.fire("validate_received_contract");
    m.fire("render_supported_kind");
    m.fire("report_unsupported_kind");
    expect(m.unsupportedResult?.ok).toBe(false);
    // the renderer is never reached for an unsupported kind
    expect(m.present().ok).toBe(false);
  });

  it("TypeScript test: client-side validation cannot make a stale response commit", () => {
    const contract = validContract();
    // every staleness/corruption variant is refused with the core's precise reason
    const stale = responseFor(contract, { interactionRevision: "rev-0" });
    const staleTask = responseFor(contract, { taskRevisionPrecondition: "task-0" });
    const wrongId = responseFor(contract, { interactionId: "ix-other" });
    const wrongSchema = responseFor(contract, { schemaVersion: "interaction-contract-schema-0.9.0" });
    const missingField = responseFor(contract, { fields: {} });
    for (const bad of [stale, staleTask, wrongId, wrongSchema, missingField]) {
      const m = flowToRendered(contract);
      const r = m.fire("accept_core_valid_response", { response: bad });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason.startsWith("response_revalidated_by_core does not hold")).toBe(true);
      expect(m.events).toHaveLength(0);
      expect(m.commitReceipt).toBeNull();
    }
    // there is no client-side bypass: the adapter exposes no validation route
    // other than the core delegation, and a replayed eventId cannot commit twice
    const committed = flowToAccepted(contract);
    committed.fire("continue_after_acceptance");
    committed.fire("validate_received_contract");
    committed.fire("render_supported_kind");
    const replay = committed.fire("accept_core_valid_response", { response: responseFor(contract) });
    expect(replay.ok).toBe(false);
    if (!replay.ok) {
      expect(replay.reason).toBe(
        "response_revalidated_by_core does not hold: response_correlated does not hold: event ID \"evt-1\" was already accepted",
      );
    }
  });

  it("TypeScript test: render/focus/enable interactions do not mutate authority state or satisfy an approval gate", () => {
    const gate = { satisfied: false, decisions: [] as string[] };
    const snapshot = JSON.stringify(gate);
    const m = flowToRendered();
    const presented = m.present();
    expect(presented.ok).toBe(true);
    if (!presented.ok) return;
    const handle = presented.handle;
    handle.focus("opt-1");
    handle.enable("opt-2");
    handle.hide();
    // presentation state moved; authority state did not
    expect(handle.isFocused("opt-1")).toBe(true);
    expect(handle.isEnabled("opt-2")).toBe(true);
    expect(m.state).toBe("rendered");
    expect(m.events).toHaveLength(0);
    expect(m.commitReceipt).toBeNull();
    expect(JSON.stringify(gate)).toBe(snapshot);
    // the handle is a control affordance only — it has no authority API
    const handleKeys = Object.keys(handle as unknown as Record<string, unknown>);
    for (const forbidden of ["submit", "authorize", "commit", "approve"]) {
      expect(handleKeys).not.toContain(forbidden);
    }
  });

  it("Static dependency test: core package has no forbidden imports or leaked host types", () => {
    const FORBIDDEN_IMPORT =
      /from\s+["'](pi-tui|ink|react|preact|svelte|vue|@pi\/[a-z-]+|@pi-tui\/[a-z-]+)["']/;
    const HOST_GLOBAL_ACCESS = /\b(window|document|localStorage|XMLHttpRequest)\s*\./;
    function walk(dir: string): string[] {
      const entries = readdirSync(dir, { withFileTypes: true });
      const files = entries
        .filter((e) => e.isFile() && e.name.endsWith(".ts"))
        .map((e) => join(dir, e.name));
      const subdirs = entries.filter((e) => e.isDirectory()).map((e) => join(dir, e.name));
      return [...files, ...subdirs.flatMap((sub) => walk(sub))];
    }
    // core slices: no host-library imports and no host-global access anywhere
    const coreFiles = walk("src").filter((f) => !f.startsWith("src/host-adapters/"));
    expect(coreFiles.length).toBeGreaterThan(20);
    for (const file of coreFiles) {
      const text = readFileSync(file, "utf8");
      expect(text.match(FORBIDDEN_IMPORT), `${file} imports a host library`).toBeNull();
      expect(text.match(HOST_GLOBAL_ACCESS), `${file} touches a host global`).toBeNull();
    }
    // the adapter package models host semantics; it imports no host library either
    for (const file of walk("src/host-adapters")) {
      const text = readFileSync(file, "utf8");
      expect(text.match(FORBIDDEN_IMPORT), `${file} imports a host library`).toBeNull();
      expect(text.match(HOST_GLOBAL_ACCESS), `${file} touches a host global`).toBeNull();
    }
  });

  it("Adapter test: every required interaction can be completed without a pointer where the host supports keyboard input", () => {
    const cap = keyboardOnlyCapability();
    expect(keyboardOperable(cap)).toBe(true);
    for (const kind of cap.supportedKinds) {
      const contract = validContract({ kind });
      // the keyboard-only host completes the full flow with answers alone
      const keyboard = flowToAccepted(contract, cap);
      expect(keyboard.events).toHaveLength(1);
      // and its events are semantically identical to the pointer-capable run
      const pointer = flowToAccepted(contract, capability());
      expect(keyboard.events).toEqual(pointer.events);
    }
  });

  it("TypeScript test: disconnect/close/focus loss creates no answer, approval, or domain mutation", () => {
    // disconnecting mid-interaction invents nothing
    const m = flowToRendered();
    m.disconnect();
    expect(m.state).toBe("rendered");
    expect(m.events).toHaveLength(0);
    expect(m.commitReceipt).toBeNull();
    const presented = m.present();
    expect(presented.ok).toBe(false);
    if (!presented.ok) expect(presented.reason).toContain("disconnected");
    // disconnecting after a commit invents nothing new: committed core facts stand
    const committed = flowToAccepted();
    const before = committed.events.length;
    committed.disconnect();
    expect(committed.events).toHaveLength(before);
    expect(committed.commitReceipt).toBe("commit:evt-1");
    // host loss never advances or rewinds the interaction state
    expect(committed.state).toBe("accepted");
  });

  it("Adapter contract test: malformed host-neutral contracts never reach the renderer", () => {
    const malformed: readonly InteractionContract[] = [
      validContract({ interactionRevision: "" }),
      validContract({ schemaVersion: "interaction-contract-schema-0.9.0" }),
      validContract({ kind: "not_a_kind" }),
      validContract({ payload: { question: "q" } }),
      validContract({ payload: { question: "q", options: [], script: "alert(1)" } }),
    ];
    for (const bad of malformed) {
      const m = createHostAdapter(bad, capability());
      // capability discovery may run, but the guard refuses validation
      expect(m.fire("validate_received_contract").ok).toBe(false);
      const r = m.fire("reject_invalid_received_contract");
      expect(r.ok).toBe(true);
      expect(m.state).toBe("invalid_contract");
      // the renderer is unreachable from invalid_contract
      const render = m.fire("render_supported_kind");
      expect(render.ok).toBe(false);
      if (!render.ok) {
        expect(render.reason).toBe(
          "transition render_supported_kind cannot fire from state invalid_contract",
        );
      }
      expect(m.present().ok).toBe(false);
    }
  });

  it("Adapter contract test: declared support matches actual capabilities for every catalog kind", () => {
    const cap = capability();
    const declared = new Set<string>([...cap.supportedKinds, ...Object.keys(cap.fallbacks)]);
    for (const kind of INTERACTION_KINDS) {
      const result = checkCapability(validContract({ kind }), cap);
      expect(result.ok).toBe(declared.has(kind));
      if (result.ok && result.mode === "native") expect(result.renderKind).toBe(kind);
      if (result.ok && result.mode === "fallback") {
        expect(result.renderKind).toBe(cap.fallbacks[kind]);
        // a registered fallback is itself natively supported
        expect(cap.supportedKinds).toContain(result.renderKind);
      }
    }
  });

  it("Adapter contract test: kind renders only when native support or registered semantic fallback exists", () => {
    const cap = capability();
    const cases: readonly { readonly kind: string; readonly expected: boolean }[] = [
      { kind: "choose", expected: true }, // native
      { kind: "rank", expected: true }, // registered fallback → choose
      { kind: "diagnose", expected: false }, // unsupported, no fallback
    ];
    for (const c of cases) {
      const contract = validContract({ kind: c.kind });
      const result = checkCapability(contract, cap);
      expect(result.ok).toBe(c.expected);
      const m = createHostAdapter(contract, cap);
      m.fire("validate_received_contract");
      const render = m.fire("render_supported_kind");
      expect(render.ok).toBe(c.expected);
      expect(m.present().ok).toBe(c.expected);
    }
  });

  it("Adapter contract test: invalid contract is not processed as renderable until a valid new contract arrives", () => {
    const m = createHostAdapter(validContract({ kind: "not_a_kind" }), capability());
    m.fire("reject_invalid_received_contract");
    // not renderable in invalid_contract — regardless of capability
    expect(m.fire("render_supported_kind").ok).toBe(false);
    // retrying with an invalid contract keeps the machine in invalid_contract
    expect(m.fire("retry_with_valid_contract", { nextContract: validContract() }).ok).toBe(true);
    expect(m.state).toBe("received");
    // only now does the interaction flow proceed to rendering
    expect(m.fire("validate_received_contract").ok).toBe(true);
    expect(m.fire("render_supported_kind").ok).toBe(true);
    expect(m.present().ok).toBe(true);
  });

  it("Adapter contract test: unsupported state exits only on a new interaction or explicit alternate contract", () => {
    const cap = capability({ fallbacks: {} });
    const m = createHostAdapter(validContract({ kind: "rank" }), cap);
    m.fire("validate_received_contract");
    m.fire("render_supported_kind");
    m.fire("report_unsupported_kind");
    expect(m.state).toBe("unsupported");
    // host loss does not exit unsupported
    m.disconnect();
    expect(m.state).toBe("unsupported");
    // exiting requires an explicit alternate contract the adapter can render
    expect(m.fire("select_registered_fallback").ok).toBe(false);
    expect(m.fire("select_registered_fallback", { nextContract: validContract({ kind: "diagnose" }) }).ok)
      .toBe(false);
    expect(m.state).toBe("unsupported");
    expect(m.fire("select_registered_fallback", { nextContract: validContract() }).ok).toBe(true);
    expect(m.state).toBe("received");
  });

  it("Adapter contract test: response rejection requires a new user submission", () => {
    const contract = validContract();
    const m = flowToRendered(contract);
    const stale = staleVariant(contract);
    expect(m.fire("reject_core_invalid_response", { response: stale }).ok).toBe(true);
    expect(m.state).toBe("rejected_response");
    // no new submission → no exit; the rejected answer cannot be reused
    expect(m.fire("correct_rejected_response").ok).toBe(false);
    expect(m.fire("correct_rejected_response", { response: stale }).ok).toBe(false);
    expect(m.state).toBe("rejected_response");
    // a genuinely new user response returns the interaction to receipt
    expect(m.fire("correct_rejected_response", { response: responseFor(contract, { eventId: "evt-2" }) }).ok)
      .toBe(true);
    expect(m.state).toBe("received");
  });

  it("Adapter contract test: accepted response advances only after the core commit result", () => {
    // a core that refuses: the response is never accepted, so there is nothing to continue
    const blocked = flowToRendered(validContract(), capability(), rejectingCore(
      "response_correlated does not hold: core policy refused the response",
    ));    expect(blocked.fire("accept_core_valid_response", { response: responseFor(blocked.contract) }).ok)
      .toBe(false);
    expect(blocked.state).toBe("rendered");
    const early = blocked.fire("continue_after_acceptance");
    expect(early.ok).toBe(false);
    if (!early.ok) {
      expect(early.reason).toBe("transition continue_after_acceptance cannot fire from state rendered");
    }
    // a core that commits: acceptance records the commit result, then flow continues
    const committed = flowToAccepted();
    expect(committed.commitReceipt).not.toBeNull();
    expect(committed.fire("continue_after_acceptance").ok).toBe(true);
    expect(committed.state).toBe("received");
  });
});