## 2026-10-18: batch 1 — analysis, then triggers, conditions and buffs

**Goal:** the owner's kit process ([kit-process.md](../kit-process.md)): analyse
all seven batch-1 operators first, then implement the missing features per
family, not per operator. Owner: implement every gap (nothing deferred);
any equipment on any operator; P5 default for 4- and 5-stars in batch 2.

**Done:**
- Analysis: seven gap reports and the merged table
  ([kit-batches/batch-1.md](../kit-batches/batch-1.md)), whose "Progress"
  section lists what's implemented.
- Values from talent, potential, weapon and gear-set skills (V1) and
  mode-limited talent effects (C3).
- One event model (engine `events.ts`): hits, casts, status events, buffs
  applied / ended / ticking, stacks, heals. One `triggers` list per kit
  replaces `comboTriggers` and `teamTriggers` (combo windows are an
  `openCombo` action); actions apply, gain, energy, SP, buffs (apply,
  extend, end layers), cooldowns, heals and hits. Triggered hits name
  their damage type (`none` exists).
- Equipment kits (`kits/equipment/<id>.json`) for weapons and gear sets act
  for the wearer through `effectiveKit`.
- Predicates for who is controlled, enemy debuffs from anyone, element,
  profession, team-buff recipients and the event's operator; an `if` on
  every effect.
- Buffs: layers, next-cast consumption (Link), attribute modifiers (UGE),
  recipient filters, stacking keys, open-ended and 0 s buffs, ticks.

**Decisions and why:**
- Patterns, not fields: ending a buff on a skill or with its parent, or
  starting one when another ends, are triggers (`on: cast` / `buffEnded`),
  not new buff fields; pausing a buff is `extendBuff` by the pause.
- Equipment IDs are prefixed (`<equipment>.<id>`) instead of rewritten by
  the loader: unambiguous, and predicates need no renaming.
- A hit's `controlled` predicate uses who was controlled at its cast
  (Typhoeus's report), not at landing.

**Problems found:** operator elements came from the data capitalised
("Fire"), so `teamSlotElement` could never match; fixed. Every step was
checked against the session's starting commit: example totals, log-check
and reaction-replay verdicts on all fixtures are identical.

**Next:** values and resources (V2–V5), data compilation (D1), skills
(S1–S7), arts state (A1–A5), physical state and timing, log tooling; then
re-analysis of the seven and the kits.
