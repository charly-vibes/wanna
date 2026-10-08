// Purpose: cross-host semantic normalization for conformance comparisons
// Responsibilities: reduce web/TUI host answers to canonical core events and compare their semantics
// Rationale: conformance compares normalized event semantics, not pixel or layout identity ([[spec.cross_host_semantics_checked]])
export interface HostAnswer {
  readonly adapter: "web" | "tui";
  readonly events: readonly string[];
}

export type SemanticMatch =
  | { readonly ok: true; readonly normalized: readonly string[] }
  | { readonly ok: false; readonly reason: string };

const EVENT_MAP: Readonly<Record<string, string>> = {
  "web/pointer-select:option-2": "choose:option-2",
  "web/click:primary": "commit:primary",
  "tui/move-down:option-2": "choose:option-2",
  "tui/enter:primary": "commit:primary",
};

export function normalizeEvents(answer: HostAnswer): readonly string[] {
  return answer.events.map((event) => EVENT_MAP[`${answer.adapter}/${event}`] ?? `${answer.adapter}/${event}`);
}

export function adapterSemanticsMatch(answers: readonly HostAnswer[]): SemanticMatch {
  if (answers.length === 0) return { ok: false, reason: "no answers to compare" };
  const first = normalizeEvents(answers[0]!);
  for (const answer of answers.slice(1)) {
    const normalized = normalizeEvents(answer);
    for (let i = 0; i < Math.max(normalized.length, first.length); i++) {
      if (normalized[i] !== first[i]) {
        return { ok: false, reason: `event ${i} mismatch: ${first[i] ?? "absent"} vs ${normalized[i] ?? "absent"}` };
      }
    }
  }
  return { ok: true, normalized: first };
}
