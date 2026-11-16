# Damage

Part of the [design](../design.md): The damage formula and damage distributions.

Follows the **game's own pipeline**, as encoded in BuffData (see
[data-sources.md](../data-sources.md#3-damage-formula)), not a flat product of
named multipliers:

1. Attacker and defender sides each accumulate modifiers by zone:
   `NormalCalcZone`-type zones add within a side, `ProdCalcZone` multiplies
   within a side; the two sides multiply.
2. Pre-calculation modifiers (ATK ratio, crit rate and damage, attribute
   edits in the game's formula slots, zone additions), then raw damage
   (ATK × scale, attribute × scale, fixed value), then post-calculation
   modifiers.
3. Shared factors: DEF, RES × damage taken, weakness, protection, level
   coefficient.
4. Crit last.

Each hit keeps its full breakdown (zone values and the buffs that fed them),
so it can be compared with a ZMDLogs hit and its buff events.

**Crit modes:** `expected` (each hit × (1 + rate × crit DMG); deterministic,
for search), `never` / `always` (in-game tests), `rolled` (each hit crits
or not by a seeded roll: one battle as it could go). Owner (2026-10-19):
crits make damage variable, so the simulator gives both one battle with
rolled crits and the spread over many (`simulateRuns`, `efsim simulate
--runs n`: mean, standard deviation, percentiles). With `expected`, no hit
counts as a crit for triggers (`on: {event: "hit", crit: true}`):
crit-triggered effects need `rolled` (Endaxis fires them on every
crit-capable hit, which overstates them; Zero Sanity tracks expected stack
counts). `distribution` (2026-11-13) is `expected` but for the kit hits a
crit trigger could fire on, which are rolled: one seeded battle of the
[damage distribution](#damage-distributions). With `expected` (and
`distribution`) each hit that may crit also carries its two values
(`HitDamage.critSpread`: v and v(1 + crit DMG), its chance), so a battle's
total is a distribution, not only its mean. Randomness comes from mulberry32
streams in the timeline state, one per source (`crit`, `dodge`, `chance`,
`landed`), each seeded from the scenario's `seed` mixed with the stream's
name, so adding one kind of roll doesn't reshuffle another; never
`Math.random`.

**Enemy attacks and dodges** (owner, 2026-10-19): the scenario lists the
enemy's attacks and skill charges (times or every n seconds, on the
enemy's clock; default none) as `attacked` / `enemyCharge` events.
With `dodge: {chance}` the controlled operator dashes at every attack on
it, and the dash is a perfect dodge with that chance (the `dodge` stream);
a missed one is an ordinary hit. A perfect dodge (from BuffData
`buff_common_dash_behit_listener`): ends the current action (not an
ultimate before its exclusive frames), +7 SP, the world slowed by the
data's curve (about 15 frames lost; the dodger exempt; cooldowns run on),
the dodger frozen by its own curve, the perfect-dodge skill's 15 frames,
and a `perfectDodge` event instead of the attack on it. Not modelled: dash
stamina, the 0.5 s no-dash after a perfect dodge, the dash attack, dodges
by choice in a rotation.

**Numerics:** game tables are float32, and the game may compute in float32.
Where that matters, emulate it explicitly (`Math.fround` ↔ `f32`) behind one
switch, decided by fixtures. Rounding steps (attribute floor, final damage)
are each one switch; see [rounding](../data-sources.md#rounding). Empirical
rounding rules fitted on a couple of data points are hypotheses, not facts.

## Damage distributions

The owner (2026-11-13): a simulation's result is a distribution, not one
number. Every random outcome contributes five numbers that **add** across
independent outcomes (`DamageMoments`, `packages/engine/src/moments.ts`):
`min` (least possible damage), `mean`, `max` (most possible), `var`
(variance) and `m3` (third central moment). The fight's are their sums;
from them the standard deviation and approximate 5th / 95th percentiles.

- **A hit** with damage v (no crit), crit chance p and crit DMG c (the
  engine's, capped as for `expected`): min v, max v(1 + c), mean v(1 + pc),
  var v²c²p(1 − p), m3 v³c³p(1 − p)(1 − 2p) (`critMoments`). A hit that
  can't crit, a rolled one, Fixed DMG: all at its value. The mean is the
  `expected`-mode value itself (`HitDamage.exact`), so a battle's mean is
  its expected-mode total to the same double (`TimelineResult.moments`).
- **A random count** (`KitHit.landedCount`, first Ardelia's sheep: in-game
  test 96): N of a cast's L planned landings land, N from observed counts.
  The cast's landings are one random sum of N copies of X, X the uniform
  mixture of its landings' distributions (`mixtureMoments`: exact when the
  landings are alike, as one cast's are): mean E[N]κ1, var E[N]κ2 +
  Var[N]κ1², m3 E[N]κ3 + 3Var[N]κ1κ2 + κ3(N)κ1³ (κ: X's mean, variance,
  third moment; `compoundMoments`); min minN·minX, max maxN·maxX. A cast
  cut short (L' of L landings left) thins N hypergeometrically
  (`thinPmf`). The cast is independent of other casts. In `expected` mode
  each landing deals its damage (and Stagger) × E[N] / L, the mean; in
  `rolled` mode N is drawn on stream `landed` and N landings chosen
  uniformly (so `simulateRuns` samples it). A log replay lands the ones
  the log shows, at their logged frames, and drops the cast's other
  planned landings (`replayCast`).
- **Outcomes that change what happens later** aren't independent of the
  rest: perfect dodges (a scenario's `dodge`; none unless given), kit
  triggers with a `chance`, and crit-triggered effects. Then K seeded
  battles (default 8; `simulateDistribution` `battles`, `efsim simulate
  --battles k`) are played, crit-triggered teams in crit mode
  `distribution`: only the hits a crit trigger could fire on (its operator
  and `by`, its `on` filters but `crit`; engine-rules C8) roll their crit
  (stream `crit`) and count at their rolled value; every other hit counts
  as its five fields. The battles combine by the **law of total
  cumulance** (`combineBattles`), over battles B equally likely: mean
  E[μ_B]; var E[σ²_B] + Var[μ_B]; m3 E[m3_B] + 3 Cov(μ_B, σ²_B) + κ3(μ_B)
  (population moments over the K). The mean then has a sampling error,
  printed (`meanError`: the battle means' sample sd / √K). Without such
  outcomes one battle gives the distribution exactly.
- **Bounds** (the lead and the owner, 2026-11-13): `min` is the battle with
  crits `never` (so no crit-triggered effect fires) and every random count
  at its fewest (`TimelineOptions.landedCounts: "least"`, the first
  landings); `max` the battle with crits `always` (every crit trigger fires
  as early as it can) and the most. That these bound the fight assumes
  crit-triggered effects only raise damage. With dodges or trigger chances
  they're the least / greatest over the K seeds' never / always battles:
  bounds over the battles seen, and the output says so. If a bound battle
  can't play the rotation, the battles' own sums of per-hit bounds stand in
  (`boundsNote`).
- **Percentiles** by the Cornish–Fisher expansion to the skew's term
  (`cornishFisher`): x_p ≈ μ + σ (z + (z² − 1) γ₁ / 6), z = Φ⁻¹(p) (±1.645
  for 5 / 95%), γ₁ = m3 / σ³, kept within [min, max]. The kurtosis term
  needs the fourth cumulant, which isn't tracked. Many examples have a
  large positive skew (few big hits at a 5% crit rate): their 5th
  percentile is then the bound, the chance of no crit on the big hits.

Checked (2026-11-13) against `simulateRuns` (rolled crits, 400 runs):
ardelia-corrosion mean 114,744 vs 115,571 ± 875, sd 17,650 vs 17,491,
5–95% 83,975–142,039 vs 82,885–137,904; laevatain-solo mean 739,231 vs
738,711 ± 781, sd 16,304 vs 15,622, 5–95% 721,735–770,849 vs
721,735–769,149; rossi-gilberta at expected crits (K = 8) mean 1,169,156
vs 1,171,134 ± 2,773, sd 57,886 vs 55,452, 5–95% 1,042,740–1,233,169 vs
1,023,380–1,220,403; every sampled total within the bounds. A cheap version
is in tests/distribution.test.ts.

The two parts are kept apart (`packages/engine/src/planning/distribution.ts`):
`fightMoments` (mean, var, m3) and `damageBounds`. The planned follow-up
replaces `fightMoments`' K battles by one deterministic battle with
crit-triggered buffs at their expected state (probability up, expected
stacks), so the search stays one battle.
