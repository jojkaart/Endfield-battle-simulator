// The timeline engine, v1: the stepping API of docs/design.md#stepping-api.
// State is plain data; every function returns a new state. Recorded
// rotations and (later) search are drivers on top of init / legalActions /
// apply / advance.
//
// v1 models animation locks and cancel windows (from SkillData), team SP,
// cooldowns, hits landing at their kit frames with the modifiers active at
// that frame, and the enemy's arts state (status.ts): inflictions, bursts,
// reactions and their statuses. What it doesn't model yet is listed in TIMELINE_ASSUMPTIONS
// and returned with every result.
//
// The engine is split by concern under timeline/ (docs/design.md, "Engine modules"); this module re-exports
// the stepping API and its types, as @efsim/engine exports them.

export type { RotationAction, TimelineOptions, TimelineScenario, EnemyActionSpec, EnemyAction, Cast, LandedHit, LandingFacts, LandingInputs, ReactionRecord, TimelineState, TimelineContext, Acting, ChainStep, PendingBurst } from "./timeline/state.ts";
export { SP, ENERGY, COMBO_WINDOW_FRAMES, TIMELINE_ASSUMPTIONS, DODGE, JUMP, diveFrames, linkValue } from "./timeline/rules.ts";
export { createContext, panelAt, enemyActionsOf, enemyHpAt } from "./timeline/context.ts";
export type { EnergyGrantOptions } from "./timeline/resources.ts";
export { refillPoise, staggerFrames } from "./timeline/resources.ts";
export { exclusiveUntil, earliestStart, skillAvailable } from "./timeline/timing.ts";
export { landingDamage, nextRandom } from "./timeline/landing.ts";
export { TEAMMATE_PAUSE_FRAMES } from "./timeline/teammates.ts";
export { advance, memoised } from "./timeline/advance.ts";
export { init, apply, replayCast, replayWindowCount, simulate, simulateRuns, startsNow } from "./timeline/drivers.ts";
export type { ReplayCastOptions, TimelineResult, RunSpread } from "./timeline/drivers.ts";
