#!/usr/bin/env node
// efsim's entry (`node packages/cli/src/main.ts`). ESM links a module's whole static import graph before it runs any of
// it, so a first import can't guard the imports next to it: the checkout check (checkout.ts: @efsim/* must resolve to
// this checkout) runs here alone, and only then is the CLI (cli.ts) loaded. Commands and options live in cli.ts.

import "./checkout.ts";

await import("./cli.ts");
