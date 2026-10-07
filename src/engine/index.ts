// Purpose: public surface of the interaction-engine slice
// Responsibilities: re-export the domain vocabulary, evaluation, and machine
// Rationale: conformance tests bind to this barrel, not to internals
export * from "./types";
export * from "./context";
export * from "./evaluate";
export * from "./machine";