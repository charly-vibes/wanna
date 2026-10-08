// Purpose: type/dependency property tests for the interaction-primitives gate
// Responsibilities: layers-have-distinct-types and host-specific-types-absent corpus properties; names match contract TOML descriptions verbatim
// Rationale: ah check binds .espectacular/interaction-primitives/*.toml to these tests via `vitest run -t '<name>'`
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { semanticLayersSeparated, hostNeutralCore } from "../../src/interaction-primitives/invariants";
import { SEMANTIC_LAYERS } from "../../src/interaction-primitives/types";
import { validRevision } from "./fixtures";
import type { PrimitiveRevision, SemanticLayer } from "../../src/interaction-primitives/types";

const HOST_UI_TOKENS = ["dom", "react", "window", "document", "browser", "tui", "mcp"] as const;

describe("interaction-primitives properties: types", () => {
  it("TypeScript compile/schema test: semantic layers cannot be silently substituted for each other", () => {
    // compile-time distinctness: every layer must be keyed exhaustively — a
    // missing or merged key does not type-check
    const typeTokens: Record<SemanticLayer, string> = {
      need: "Need",
      contribution: "Contribution",
      pattern: "InteractionPattern",
      interaction: "InteractionContract",
      presentation: "PresentationContract",
      process: "ProcessModel",
      authority: "AuthorityState",
      evidence: "ProvenanceRecord",
      failure: "FailureRecord",
      recovery: "RecoveryContract",
      continuity: "ContinuityRecord",
    };
    expect(Object.keys(typeTokens)).toHaveLength(11);

    // runtime: the canonical revision passes the separation invariant
    expect(semanticLayersSeparated(validRevision()).ok).toBe(true);

    // a missing layer is a collapsed model, named precisely
    const layers = validRevision().layers.filter((l) => l.layer !== "authority");
    expect(semanticLayersSeparated(validRevision({ layers })).reason).toBe(
      'semantic layer "authority" is not declared',
    );

    // a duplicated layer is a collapsed model, named precisely
    const duplicated: PrimitiveRevision["layers"] = [
      ...validRevision().layers,
      { layer: "presentation", typeToken: "PresentationContract2", updateRule: "other rule" },
    ];
    expect(semanticLayersSeparated(validRevision({ layers: duplicated })).reason).toBe(
      'semantic layer "presentation" is declared more than once',
    );

    // two layers sharing a type token cannot be silently substituted
    const sharedToken = validRevision().layers.map((l) =>
      l.layer === "need" ? { ...l, typeToken: "ProcessModel" } : l,
    );
    expect(semanticLayersSeparated(validRevision({ layers: sharedToken })).reason).toBe(
      'semantic layer separation violated: layers "need" and "process" share type token "ProcessModel"',
    );

    // two layers sharing an update rule are not independently versioned
    const sharedRule = validRevision().layers.map((l) =>
      l.layer === "recovery" ? { ...l, updateRule: "track lifecycle and waits" } : l,
    );
    expect(semanticLayersSeparated(validRevision({ layers: sharedRule })).reason).toBe(
      'semantic layer separation violated: layers "process" and "recovery" share update rule "track lifecycle and waits"',
    );

    // a layer with no distinct type or no update rule is not separated
    const noToken = validRevision().layers.map((l) =>
      l.layer === "failure" ? { ...l, typeToken: "" } : l,
    );
    expect(semanticLayersSeparated(validRevision({ layers: noToken })).reason).toBe(
      'semantic layer "failure" declares no distinct type',
    );
    const noRule = validRevision().layers.map((l) =>
      l.layer === "continuity" ? { ...l, updateRule: "" } : l,
    );
    expect(semanticLayersSeparated(validRevision({ layers: noRule })).reason).toBe(
      'semantic layer "continuity" declares no update rule',
    );

    // the declared vocabulary is exactly the eleven semantic layers
    expect([...SEMANTIC_LAYERS]).toHaveLength(11);
  });

  it("Dependency test: core package imports no host UI SDK", () => {
    // scan every source file's import declarations for host UI SDK vocabulary
    const dir = join(process.cwd(), "src", "interaction-primitives");
    const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(join(dir, file), "utf8");
      const importLines = source.split("\n").filter((l) => l.trimStart().startsWith("import"));
      for (const line of importLines) {
        for (const token of HOST_UI_TOKENS) {
          expect(`${file}: ${line}`).not.toContain(token);
        }
      }
    }

    // runtime: core records are host-free by construction
    expect(hostNeutralCore(validRevision()).ok).toBe(true);

    // a revision embedding host UI vocabulary is rejected, naming the token
    const layers = validRevision().layers.map((l) =>
      l.layer === "presentation" ? { ...l, typeToken: "React.Component" } : l,
    );
    const leak = hostNeutralCore(validRevision({ layers }));
    expect(leak.ok).toBe(false);
    expect(leak.reason).toBe('host UI vocabulary in core model: react');
  });
});