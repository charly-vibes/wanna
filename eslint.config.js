// Purpose: eslint boundary rules for the wanna corpus implementation
// Responsibilities: enforce core purity independent of the test layer
// Rationale: [[spec.host_neutral_types]] + [[spec.no_effects_in_core]] — pre-commit gate (lefthook),
// deliberately NOT invoked from vitest: lint is automatic on commit, tests stay testaruda-discovered
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    plugins: { import: importPlugin },
    rules: {
      // Zone boundary: engine core may not reach outside src/engine
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/engine",
              from: "./src",
              except: ["./engine"],
              message: "interaction-engine core imports nothing outside src/engine ([[spec.host_neutral_types]])",
            },
          ],
        },
      ],
      // Ambient host globals are forbidden in all src code
      "no-restricted-globals": [
        "error",
        { name: "window", message: "host global — core is host-neutral ([[spec.host_neutral_types]])" },
        { name: "document", message: "host global — core is host-neutral" },
        { name: "fetch", message: "network effect — core performs no I/O ([[spec.no_effects_in_core]])" },
        { name: "localStorage", message: "host global" },
        { name: "XMLHttpRequest", message: "network effect" },
        { name: "process", message: "node global — core is runtime-neutral" },
        { name: "require", message: "no dynamic require in core" },
      ],
    },
  },
  {
    ignores: ["node_modules", "dist", ".espectacular", "openspec", "tools/**"],
  },
);