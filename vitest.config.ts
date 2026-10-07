// Purpose: vitest configuration for wanna conformance tests
// Responsibilities: test discovery over tests/; globals for terse spec tests
// Rationale: tracer-bullet phase 1 (wanna-79h) — testaruda adapter discovers .test.ts files here
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
});