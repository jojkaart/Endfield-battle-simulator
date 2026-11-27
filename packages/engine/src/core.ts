// The engine's core (`@efsim/engine/core`): the game model and the simulation, everything that says what happens in a
// fight and nothing that decides what to press. The kit DSL's types and predicates (model, expr, events), attributes,
// stats, effects, damage, reactions and statuses, buffs and triggers, units and errors, crit moments, and the timeline
// through its façade (timeline.ts). The data package imports only this entry (lint), and the game-data cache's key
// traces the names it imports through it (packages/data cache.ts engineSources).
//
// The planning code (planning/: the rotation search, the loop, payoffs, macros, the setup value, skeletons, the
// distribution of a rotation's total, and the rule driver policy*) imports the core only through this entry, never a
// core module directly (lint): this file is where the core ends, and what a port to another language starts from.
// Core modules never import planning code (lint). @efsim/engine (index.ts) re-exports both.

export * from "./units.ts";
export * from "./errors.ts";
export * from "./attributes.ts";
export * from "./labels.ts";
export * from "./model.ts";
export * from "./build.ts";
export * from "./constants.ts";
export * from "./effects.ts";
export * from "./stats.ts";
export * from "./damage.ts";
export * from "./reactions.ts";
export * from "./status.ts";
export * from "./events.ts";
export * from "./triggers.ts";
export * from "./buffs.ts";
export * from "./expr.ts";
export * from "./moments.ts";
export * from "./assumptions.ts";
export * from "./replay-assumptions.ts";
export * from "./timeline.ts";
