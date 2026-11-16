## 2026-10-18: arts reactions on the timeline; six kits merged

**Goal:** the timeline should trigger inflictions and reactions itself, and
the six favourites' kits (written in parallel by sub-agents, each with its
own journal notes below) should be merged with the engine changes they
asked for.

**Done:**
- `engine/src/status.ts`: one state machine for inflictions, bursts,
  reactions, forced reactions and consumption (Talos Wiki rules); Corrosion
  and Electrification act on hits as Modifiers, Combustion ticks each second.
  Kits say what each hit `applies` (the data doesn't: SpellInfliction actions
  are disabled stubs), taken from skill descriptions.
- Operator `stacks` with `gains` / `requires` (Laevatain's Melting Flame:
  her empowered battle-skill hit now lands only at 4 stacks; before, the
  timeline always counted it). Forced reactions can take duration and damage
  scale from skill values. The timeline reproduces Zero Sanity's in-game
  forced Combustion tick (2608) and empowered hit (57552) exactly.
- Final Strikes come from SkillData (mask bit 2097152) and kits can declare
  team triggers (Laevatain's Heat absorption). `triggers.ts hitEffects` is
  shared by the timeline and `efsim zmdlogs reactions`, which replays a log
  and compares predicted with logged reactions: 40d9's Combustion at 14441
  ms is predicted exactly, with no false predictions.
- Electrification's strength matches two logged rates exactly.
- Checker, from the agents' reports: logged buffs counted as BuffData says
  (stackingType 1 once, literal max stacks, decorate-mask conditions), every
  kit hit of a shared key tried, boundary buffs tried in subsets; the
  importer drops damage-taken zones on operators; skill-value condition
  sources and per-hit bonuses. Two pending fixtures now pass.

**Decisions:**
- What a hit applies takes effect before its own damage (Gilberta's and
  Arcane's logs both show it).
- Hits under Corrosion that match no level count as "under unmodelled
  effects", not mismatches: three agents found the ramp too strong in some
  logs (Si's points to ticks pausing during time dilation). Non-Corrosion
  hits stay strict.
- `buff_common_<element>_triggered` (newer logs' reaction key) is still not
  parsed as a reaction: it fits in Arcane's report only with dedupe, which
  is now in, so it can be revisited.

**Open:** e82d45c46040 stays pending (three unexplained factors). Gilberta's
d9e59 needs Liino's zero-duration buffs imported. Link isn't modelled.
