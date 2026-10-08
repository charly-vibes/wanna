// Purpose: trusted security policy, component catalog, and inert-text helpers for the interaction-security gate
// Responsibilities: frozen default policy and catalog, catalog lookup, text escaping, secret scrubbing, bounding, trusted authorization lookup
// Rationale: these inputs are host-owned trusted configuration; agent payloads never contribute to them
import type { ComponentMapping, SecurityPolicy } from "./types";

export const DEFAULT_CATALOG: readonly ComponentMapping[] = Object.freeze([
  { kind: "confirm", component: "ConfirmDialog" },
  { kind: "choose", component: "OptionPicker" },
  { kind: "annotate", component: "TextAnnotation" },
]);

export function defaultSecurityPolicy(): SecurityPolicy {
  return Object.freeze({
    maxPayloadBytes: 2048,
    maxOptionCount: 8,
    maxNestingDepth: 6,
    maxFieldLength: 256,
    allowedUrlSchemes: ["https"],
    allowedUrlHosts: ["trusted.example.com"],
    secretMarkers: ["sk-", "Bearer ", "password="],
    maxDiagnosticChars: 160,
  });
}

export function catalogComponentFor(
  kind: string,
  catalog: readonly ComponentMapping[],
): string | null {
  const hit = catalog.find((m) => m.kind === kind);
  return hit ? hit.component : null;
}

export function hostAuthorizes(action: string, grantedActions: readonly string[]): boolean {
  return grantedActions.includes(action);
}

const encoder = new TextEncoder();

export function byteLength(text: string): number {
  return encoder.encode(text).length;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

// a secret value is the marker plus a bounded run of non-space characters
const SECRET_VALUE_RUN = /[^\s]{0,64}/;

export function scrubSecrets(text: string, markers: readonly string[]): string {
  let result = text;
  for (const marker of markers) {
    let idx = result.indexOf(marker);
    while (idx !== -1) {
      const rest = result.slice(idx + marker.length);
      const run = SECRET_VALUE_RUN.exec(rest)?.[0] ?? "";
      result = `${result.slice(0, idx)}[redacted]${rest.slice(run.length)}`;
      idx = result.indexOf(marker, idx + "[redacted]".length);
    }
  }
  return result;
}

export function escapeText(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
