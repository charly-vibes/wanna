// Purpose: vitest configuration for wanna conformance tests
// Responsibilities: test discovery over tests/; globals for terse spec tests; @wanna/* source aliases for consumer examples
// Rationale: tracer-bullet phase 1 (wanna-79h) — testaruda adapter discovers .test.ts files here; wanna-01q mirrors the tsconfig paths so examples resolve without a package/workspace prerequisite
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@wanna/composition-shell": "/src/composition-shell/index.ts",
      "@wanna/review-indexeddb": "/src/review-workbench/adapters/review-indexeddb/index.ts",
    },
  },
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
});