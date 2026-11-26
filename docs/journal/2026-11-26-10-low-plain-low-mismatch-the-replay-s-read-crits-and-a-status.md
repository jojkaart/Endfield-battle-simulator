## 2026-11-26: Low plain, low mismatch: the replay's read crits and a status's crit

**Goal:** why most of Rossi's hits (and Chen Qianyu's, Yvonne's, Lifeng's, Pogranichnik's, the male Endministrator's)
match only under an assumption or the log-listing fallback; make the readings with a mechanism the default, and say
which are only the check's tolerance (open-problems "Low plain, low mismatch").

**Done:**
- **Grouped the non-plain matches by what they assume** (scripts/probes/assumed/kinds.ts): Rossi's 1109 were 418
  `crit` alone (her ultimate stabs and Seething Blood extras), 165 boundary, 181 fallbacks; Yvonne's 150 `crit`; Chen's,
  Lifeng's, Pogranichnik's and the Endministrator's nearly all fallbacks.
- **The crit the replay read is the primary reading's** (engine assumption `check-crits`, default `replay`;
  enginecheck.ts readingBasis, primaryCritRead): the replay had read those crits from the log (replaycrits.ts:
  Seething Blood extras at the stab's ms, Wolven Blood layers, values) but the check took none and assumed the crit.
- **A status's damage that crits fires triggers on crits** (engine events.ts statusCritMatches, landing.ts recordStatus
  `crits`, asEvents; a replayed status's hit takes its logged crit, reactions.ts reactionEventKeys): Chen's Wolven
  Blood layers in a9d7 gain one at each crit Lift and fell a layer further behind at each (×1.013 → ×1.044 by 69 s);
  Lupine Scarlet and MI Security are both on abilityEvent 44 (any crit). Seething Blood and the pistol's kind-filtered
  triggers don't see it.

**Scoreboard** (`npm run snapshots:update`): development plain 69.7 → 71.8%, mismatch 11.2%, mean |damage error|
6.8%; hold-out plain 81.0 → 82.1% (one log mixed: plain +65, totals); earlier pending plain 70.2 → 72.9%, mean |damage
error| 3.5 → 3.4%; verified 78.0 → 78.1%. By operator: Rossi 51.9 → 73.2%, Yvonne 31.9 → 71.2%, Chen 30.2 → 38.8%,
Pogranichnik 44.1 → 41.9%, Lifeng and the Endministrator unchanged. Better: 0c14, 2fd9, 99fb, abfd, d572, a9d7 (101 →
177 plain), 3f78, 489c, 5082, 4e5e; mixed 207f, 4a64, 9a80 (totals +0.1–0.4%); worse c4f3 (243 → 223, −2.5 → −2.9%):
Chen's layers now right, her second Wolven Blood final ends 5 s late in the replay and the hidden-hold placement, which
reads it as a clock, moves its later units, so the third final and Pogranichnik's hits at 116–146 s read ×1.04 off.
team-ab: both teams' fights unchanged; examples.json: Rossi's example +0.46% (her Lifts' crits add layers).

**Decisions:** `check-crits` registered as an engine reading so the old classification stays one `--assume` away (the
value inference is cross-validated at 0.90, not proof); the status crit isn't an assumption (the log shows the layer at
every crit Lift and none at the others). Status damage counts only for triggers on crits: nothing in the logs says
whether it counts as a hit for other hit triggers. Left as the check's tolerance: boundary buffs at the hit's ms,
kit buffs changing within 500 ms, Link the replay can't say, crits no inference reads.

**Next / open:** Pogranichnik's Thermite Cutter and Fervent Morale, both on SP the log doesn't record, behind most of
Chen's, Lifeng's, Pogranichnik's and the Endministrator's fallbacks; c4f3's Wolven Blood final end (a clock).
