import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["data/", "reference/", "node_modules/", "tools/skport-capture/", ".proto/", ".claude/worktrees/"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // Determinism (design principle 9): no hidden randomness or clock in game logic.
    files: ["packages/engine/**/*.ts", "packages/data/src/**/*.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Use a seeded PRNG passed in." },
        { object: "Date", property: "now", message: "No clock in game logic." },
      ],
    },
  },
  {
    // The engine imports nothing outside its own package (design principle 4).
    files: ["packages/engine/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@efsim/*", "../../*", "node:*"], message: "The engine has no dependencies." }] },
      ],
    },
  },
);
