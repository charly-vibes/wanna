// Purpose: fast-check property-based tests for the interaction-catalog layer
// Responsibilities: escalate generator-friendly corpus properties to PBT (100+ generated cases)
// Rationale: generators recorded in the corpus generator column (openspec/specs/interaction-catalog/spec.md);
//   contracts bind via `vitest run tests/interaction-catalog/properties-pbt.test.ts -t '<name>'`
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { authorizeDecision, createAuthorizeContract, resolveOptionReferences } from "../../src/interaction-catalog/index";
import type { AuthorizeDecisionInput, OptionSpec } from "../../src/interaction-catalog/index";

const token = fc.stringMatching(/^[a-z0-9-]{1,8}$/);

const authorizeInputArb = fc.record({
  action: token,
  scope: token,
  taskRevision: token,
  actor: token,
  expiry: token,
  policyContext: token,
});

const optionsArb: fc.Arbitrary<OptionSpec[]> = fc
  .uniqueArray(fc.record({ id: token, label: token }), { maxLength: 8 })
  .map((opts) => opts.map((o, i) => ({ id: `opt-${i}-${o.id}`, label: o.label })));

describe("interaction-catalog properties (fast-check)", () => {
  it("Security test: approval for one action/revision/actor/expiry cannot authorize a different action", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1e6 }), authorizeInputArb, (seed, input) => {
        const contract = createAuthorizeContract(input);
        expect(contract.bindingHash.length).toBeGreaterThan(0);
        // a decision binding every contracted field is authorized
        const matching: AuthorizeDecisionInput = {
          action: input.action,
          taskRevision: input.taskRevision,
          actor: input.actor,
          expiry: input.expiry,
        };
        expect(authorizeDecision(contract, matching).ok).toBe(true);
        // changing ANY bound field voids the authorization
        const tampered = [
          { ...matching, action: `${input.action}-other` },
          { ...matching, taskRevision: `${input.taskRevision}-other` },
          { ...matching, actor: `${input.actor}-other` },
          { ...matching, expiry: `${input.expiry}-other` },
        ];
        for (const decision of tampered) {
          const check = authorizeDecision(contract, decision);
          expect(check.ok).toBe(false);
          if (!check.ok) expect(check.reason).toMatch(/authorization_scope_bound does not hold/);
        }
        void seed;
      }),
      { numRuns: 100 },
    );
  });

  it("TypeScript test: duplicate or changed display labels do not alias stable option IDs", () => {
    fc.assert(
      fc.property(optionsArb, (options) => {
        // referencing stable IDs always resolves
        expect(resolveOptionReferences(options, options.map((o) => o.id)).ok).toBe(true);
        if (options.length === 0) return;
        // referencing a display LABEL is rejected — labels never alias option identity
        const byLabel = resolveOptionReferences(options, [options[0]!.label]);
        if (options[0]!.label === options[0]!.id) {
          // degenerate fixture where label equals id — skip the label/ghost distinction
          return;
        }
        expect(byLabel.ok).toBe(false);
        if (!byLabel.ok) expect(byLabel.reason).toMatch(/display label, not a stable option ID/);
        // referencing an unknown id is rejected too
        expect(resolveOptionReferences(options, ["ghost-option"]).ok).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
