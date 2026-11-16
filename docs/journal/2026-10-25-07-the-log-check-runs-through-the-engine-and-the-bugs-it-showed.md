## 2026-10-25: the log check runs through the engine (and the bugs it showed)

**Goal:** fix the blind spot pinpointed below, and the owner's rule
for the check: "if our engine can simulate something, the log [check]
should run that and compare the result with what the log says"; also
"always look at the percentage error in damage output and other relevant
totals". Then the bugs it exposes and round two's smaller engine bugs.

**Done** (one commit each; design.md, "The log check's rule"):
- Stagger counts once: `staggerModifier` (multiplicative, from
  BuffData buff_common_poise_break_damage_taken_scale's ProdCalcZone
  processor, `GameData.constants.staggerDamageTaken`) is the pipeline's
  one representation; the Stagger zone and STAGGER_DAMAGE_TAKEN are gone.
- The check reads each hit through the engine's damage path at its
  landing (`LandedHit.inputs`, `landingDamage`, enginecheck.ts); from
  the log only the crit, buffs no kit defines, the hitter's food, the
  enemy's HP, and what the replay can't judge. Kit buffs map to the
  names a log uses (`gameBuff`, `KitBuff.loggedAs`, and the affix buffs
  their files create: `RawBuffFile.affixes`), so nothing counts twice;
  the log's entries verify the engine's modifiers (the report's "engine
  against the log's listing"). The old readings are the labelled
  fallback, their Stagger the pipeline's own (Staggered-only modifiers
  apply). Totals simulated against the log's (damage per operator and
  kind, hits, status hits, hits under Stagger, last hit, crit share) are
  in the report, the verdict snapshots and the pending README.
- A pinned landing takes its own logged hit's crit (`loggedCrits` ref).
- Round two: a combo waits for anything that opens its window
  (`nextEventAfter`: enemy actions, bursts, ticks too) and startFrom
  judges all its gates again until the start settles; `enemyFrozenUntil`
  moves with time stops; ending a buff for one member rebases
  cooldowns; a cast spends the SP at its own frame; the perfect dodge's
  SP goes through `gainSp`.

**Numbers** (verified fixtures; all six still verify): plain 396 → 372,
assumed 303 → 76, fallback 49 → 300 ("plain" now means the engine's own
reading, so the ratchet's baseline was reset on purpose; per-cause
counts in the commit a778098). The engine's state fits where the old
readings assumed: b7b3 Tangtang plain 2 → 21, Last Rite 0 → 4; 0eef Si
5 → 9; 4e5e Rossi 38 → 55, Estella 21 → 28. Where it doesn't, the report
names why: Rossi's Wolven Blood layers, the replay Staggered where the
log isn't (4e5e 23–34 s, bdf2 19–24 s), Typhoeus's hover ended by her
combo, Arcane's WILL buffs, Camille's weapon ATK, a Corrosion the log
never lists (40d9), statuses and landings the replay doesn't make.
Totals (simulated / logged − 1): 0eef −27.1%, 40d9 −12.9%, 4e5e −12.5%,
b7b3 +23.1%, bdf2 −28.0%, dbae −43.9% (bound 45%). Pending (20): plain
1947 → 1334, fallback 1100 → 2736, mismatch 6004 → 5759. Negative
control: 4e5e 3 of 345 at ×0.97 (was 2), others 0. Examples and search
pins: unchanged (no example staggers its enemy, which is itself worth
a look).

**Decisions and why:**
- Kit buffs the replay can't judge (chance, enemy actions, heals of the
  controlled operator) take the log's entries in the primary reading:
  outcomes the engine can't produce, like crits.
- A disagreement on something the engine models (Stagger, Corrosion,
  layers) is a lead, not an assumption: such hits fall back, labelled,
  rather than match "assumed"; only what the replay's own timing leaves
  open (500 ms edges, unlogged crits) is tried as an assumption.
- The affix mapping is data (VulnerableAction / EnhancedAction subType
  → element, checked against the actions that name their child buff);
  `loggedAs` only for names the data doesn't link (Liino's `_owner`).
- `engine: false` keeps the fallback's readings testable on their own.

**Dead ends:** a constant-ratio search for the remaining fallbacks by
repricing zones (ATK's formula made it unreliable); the replay's
`loggedModifiers` path (the check now adds the log-only effects itself,
for status hits too).

**Left:** the leads above (roadmap 3); the enemy's side of conditions is
still tried both ways; poise per hit isn't in the fixtures (the API has
`poiseDamage`); reaction levels from the log are tried; 458b's
Laevatain ×1.3 stays unexplained; totals' error 12–44%.
