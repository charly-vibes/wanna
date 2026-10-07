// Purpose: public surface of the component-catalog slice
// Responsibilities: re-export the domain vocabulary, invariants, machine, render, review
// Rationale: conformance tests bind to this barrel, not to internals
export * from "./types";
export * from "./invariants";
export * from "./machine";
export * from "./render";
export * from "./reviewed-change";