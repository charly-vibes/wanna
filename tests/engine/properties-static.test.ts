// Purpose: static conformance tests for interaction-engine core purity
// Responsibilities: no host imports / ambient types; no I/O or effect calls in core
// Rationale: derives_from [[spec.host_neutral_types]] and [[spec.no_effects_in_core]] —
// independent of the eslint pre-commit gate (defense in depth); testaruda tracks these
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ENGINE_DIR = "src/engine";
const sources = readdirSync(ENGINE_DIR).filter((f) => f.endsWith(".ts")).map((f) =>
  readFileSync(join(ENGINE_DIR, f), "utf8"),
);

describe("core_has_no_host_or_io_imports", () => {
  it("imports nothing outside src/engine (relative-only imports)", () => {
    const offenders = sources.flatMap((src, i) =>
      (src.match(/^import[^;]+from\s+["']([^"']+)["']/gm) ?? [])
        .filter((m) => {
          const spec = m.match(/["']([^"']+)["']/)![1]!;
          return !spec.startsWith("./") && !spec.startsWith("../") && spec !== "vitest";
        })
        .map((m) => `${readdirSync(ENGINE_DIR)[i]}: ${m}`),
    );
    expect(offenders).toEqual([]);
  });

  it("declares no ambient host types", () => {
    const hostTypes = /\b(HTMLElement|React\.|TUI|Document|Window)\b/;
    expect(sources.filter((s) => hostTypes.test(s))).toEqual([]);
  });
});

describe("core_evaluation_has_no_effects", () => {
  it("references no fs, network, UI, model, or domain-action ports", () => {
    const effects = /\b(require\(|readFileSync|writeFileSync|fetch\(|XMLHttpRequest|http\(|https\(|console\.|process\.)/;
    const offenders = sources.map((s, i) => (effects.test(s) ? readdirSync(ENGINE_DIR)[i] : null)).filter(Boolean);
    expect(offenders).toEqual([]);
  });
});