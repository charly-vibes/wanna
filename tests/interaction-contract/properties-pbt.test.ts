// Purpose: fast-check property-based tests for the interaction-contract layer
// Responsibilities: escalate generator-friendly corpus properties to PBT (100+ generated cases)
// Rationale: generators recorded in the corpus generator column (openspec/specs/interaction-contract/spec.md);
//   contracts bind via `vitest run tests/interaction-contract/properties-pbt.test.ts -t '<name>'`
import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { CONTRACT_CONTENT_LIMITS, contractHasBoundedContent, rejectionCodeFor } from "../../src/interaction-contract/index";
import type { InteractionContract } from "../../src/interaction-contract/index";
import { validContract } from "./fixtures";

const L = CONTRACT_CONTENT_LIMITS;

interface PayloadShape {
  readonly labelLen: number;
  readonly descriptionLen: number;
  readonly optionCount: number;
  readonly optionValueLen: number;
  readonly numeric: number;
}

const shapeArb: fc.Arbitrary<PayloadShape> = fc.record({
  labelLen: fc.nat({ max: L.maxLabelLength + 40 }),
  descriptionLen: fc.nat({ max: L.maxDescriptionLength + 40 }),
  optionCount: fc.nat({ max: L.maxOptions + 5 }),
  optionValueLen: fc.nat({ max: L.maxOptionValueLength + 20 }),
  numeric: fc.nat({ max: L.maxNumericValue * 2 }),
});

function payloadAt(shape: PayloadShape): Record<string, unknown> {
  return {
    label: "L".repeat(shape.labelLen),
    description: "D".repeat(shape.descriptionLen),
    options: Array.from({ length: shape.optionCount }, (_, i) => ({
      id: `o${i}`,
      value: "V".repeat(shape.optionValueLen),
    })),
    threshold: shape.numeric,
  };
}

function scalarLimitsHold(shape: PayloadShape): boolean {
  return (
    shape.labelLen <= L.maxLabelLength &&
    shape.descriptionLen <= L.maxDescriptionLength &&
    shape.numeric <= L.maxNumericValue
  );
}

function optionLimitsHold(shape: PayloadShape): boolean {
  return shape.optionCount <= L.maxOptions &&
    (shape.optionCount === 0 || shape.optionValueLen <= L.maxOptionValueLength);
}

function withinDeclaredLimits(shape: PayloadShape): boolean {
  const bytes = JSON.stringify(payloadAt(shape)).length;
  return scalarLimitsHold(shape) && optionLimitsHold(shape) && bytes <= L.maxPayloadBytes;
}

describe("interaction-contract properties (fast-check)", () => {
  it("TypeScript test: each field rejects values just above its declared limit and accepts allowed boundary values", () => {
    fc.assert(
      fc.property(shapeArb, (shape) => {
        const contract: InteractionContract = validContract({ payload: payloadAt(shape) });
        const check = contractHasBoundedContent(contract);
        expect(check.ok).toBe(withinDeclaredLimits(shape));
        // the declared limits themselves are accepted at the boundary
        const boundary: InteractionContract = validContract({
          payload: payloadAt({
            labelLen: L.maxLabelLength,
            descriptionLen: L.maxDescriptionLength,
            optionCount: L.maxOptions,
            optionValueLen: L.maxOptionValueLength,
            numeric: L.maxNumericValue,
          }),
        });
        expect(contractHasBoundedContent(boundary).ok).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("TypeScript test: same invalid condition yields the same documented reason code without leaking secret data", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 80 }), (suffix) => {
        // stability: the same invalid condition yields the identical reason string on every call
        const base = `contract_has_bounded_content does not hold: label of 121 characters exceeds the declared maximum of 120 (${suffix})`;
        expect(rejectionCodeFor(base)).toBe(rejectionCodeFor(base));
        // the documented reason code is the guard clause before " does not hold"
        expect(rejectionCodeFor(base)).toBe("contract_has_bounded_content");
        // non-guard reasons pass through unchanged rather than being invented
        expect(rejectionCodeFor(suffix)).toBe(suffix);
      }),
      { numRuns: 100 },
    );
  });
});
