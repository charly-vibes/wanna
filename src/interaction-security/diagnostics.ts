// Purpose: data-minimized rejection diagnostics for the interaction-security gate
// Responsibilities: map a failed Check to a stable reason code plus bounded, secret-free detail
// Rationale: diagnostics expose the actionable cause without echoing secrets, private data, or unbounded hostile payloads
import { scrubSecrets, truncate } from "./policy";
import type { Check, SecurityPolicy } from "./types";

export interface RejectionDiagnostic {
  readonly reasonCode: string;
  readonly detail: string;
}

export function buildRejectionDiagnostic(
  check: Check,
  policy: SecurityPolicy,
): RejectionDiagnostic {
  const raw = check.reason ?? "unknown rejection";
  const detail = truncate(scrubSecrets(raw, policy.secretMarkers), policy.maxDiagnosticChars);
  return { reasonCode: check.code ?? "unknown_rejection", detail };
}
