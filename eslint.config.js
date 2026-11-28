import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["data/", "reference/", "node_modules/", "tools/skport-capture/", ".proto/", ".claude/worktrees/", "scratch/", "scripts/probes/"] },
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
  {
    // The core never imports the planning code (packages/engine/src/core.ts says where the core ends).
    files: ["packages/engine/src/**/*.ts"],
    ignores: ["packages/engine/src/index.ts", "packages/engine/src/planning/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@efsim/*", "../../*", "node:*"], message: "The engine has no dependencies." },
            { group: ["./planning/*", "../planning/*"], message: "The core doesn't import the planning code (core.ts)." },
          ],
        },
      ],
    },
  },
  {
    // The planning code imports the core only through its entry (core.ts), never a core module directly.
    files: ["packages/engine/src/planning/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@efsim/*", "../../*", "node:*"], message: "The engine has no dependencies." },
            { group: ["../*", "!../core.ts"], message: "Planning code imports the core through ../core.ts only (core.ts)." },
          ],
        },
      ],
    },
  },
  {
    // The data package uses the engine's core only (@efsim/engine/core): the game-data cache's key traces it.
    files: ["packages/data/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "@efsim/engine", message: "The data package imports @efsim/engine/core (the engine's core: core.ts), not the whole engine." }] },
      ],
    },
  },
  {
    // World time in ms is a float of thirds of a ms (frames at 30 fps): an exact comparison with it fails on rounding
    // (round 23, the placement-cases report point 4: a byTime rule `worldMs(a, b, stops) === due` never fired).
    files: ["packages/logs/**/*.ts", "scripts/**/*.ts", "tests/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "BinaryExpression[operator=/^[!=]==?$/] > CallExpression[callee.name=/^(worldMs|heldWorldMs)$/]",
          message: "worldMs is a float of thirds of a ms: compare with a tolerance (|a − b| < 1e-6), or ask heldMs(from, to, stops) === 0 for \"no stop held this span\" (logcasts.ts).",
        },
      ],
    },
  },
);
