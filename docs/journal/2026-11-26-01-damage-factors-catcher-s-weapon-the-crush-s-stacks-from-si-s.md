## 2026-11-26: Damage factors: Catcher's weapon, the Crush's stacks from Si's away press, Ember's listed layers

**Goal:** the damage factors the misprediction statistics left, largest first: the Crush ×2.2 (0c14) and ×1.90 (2fd9),
04d4's Catcher ×2.1 and Snowshine ×0.962, Ember's ×1.096 (7e19), Rossi's ultimate ×1.09 / ×1.08, bleed clock, slash2
extras and combo_3 over-hold, then the cast tails; another agent held the replay, holds and check files.

**Done** (open-problems "Misprediction statistics", The damage factors):
- **The Crush is right; its misses were Vulnerable stacks.** Every logged Crush reads exactly with the data's
  multiplier by stacks consumed. Rossi's perfect combo gives a Lift and one more stack per consumed infliction, so one
  infliction the replay lacks costs two stacks: 2fd9's (fixed by round 4's counter bash), and 0c14's at 182.30 s (2 →
  4: 172,059 exactly). 0c14's cause: Si's battle-skill press in the away stretch (139.68 s), made by the replay, landed
  nothing in the game, and her hitless 153.99 s press was her battle skill (Jade Vessel's Immobilization debuff listed
  from the next hit, her Artful Intent ending at the log's 181.00 s). Hard-coded as a measurement:
  docs/tried/2026-11-26-0c14-si-away-press.diff (0c14 plain 172 → 293, −4.9 → +1.2%); the rule is the replay's.
- **04d4's Catcher: weapon level 3** (fixture buildOverrides). fit-build threw on his DEF-scaled hits under a DEF food
  candidate; such a candidate is now unscored (buildfit.ts, tests/buildfit-fit.test.ts). 04d4 plain 185 → 376.
- **Ember's ×1.096:** the check's loggedEntries dropped her listed talent ATK (+0.09) as one of Thermite Cutter's
  layers (fix held back: docs/tried/2026-11-26-log-entries-own-buff.diff, hold-out plain 79.0 → 80.4%, 3 better, 0
  worse), and her talent's layers aren't listed (one entry at 1–3 layers: 04d4's steps ×1.023 / 1.085 / 1.147).
- **Rossi:** her ultimate's ×1.09 / ×1.08 fit now (closed); the slash2s without an extra are a fight's or a life's last
  hit (scripts/probes/rossi/slash2.py; the totals rule is mixed and too broad, docs/tried/2026-11-26-life-end-landings.diff);
  the bleed's unlanded ticks and combo_3's over-hold left to the holds' owner.
- Snowshine narrowed (her attribute bonus 3.325 → 3.200 exactly; no weapon level or node count reaches it); the cast
  tails' largest are stage, two-target and placement cases, no kit cause.

**Scoreboard** (`npm run snapshots:update`): verified unchanged; development plain 69.0%, mismatch 11.4%, mean |damage
error| 7.0% (unchanged); hold-out 79.0%, 5.9%, 8.5% (unchanged); earlier pending plain 64.7 → 66.3%, mismatch 13.9 →
12.0%, mean |damage error| 4.1 → 4.2% (04d4 mixed: per hit 17.9 → 6.5%, its total +2.1 → −3.0%, the over-prediction had
hidden the rest of its deficit). No kit or engine change: team-ab not needed.

**Decisions:** fixes in files another agent held were measured with `--patch` and kept as docs/tried diffs marked held
back (README paragraph), not applied; Catcher's level-3 weapon taken though the weapon's skill levels (3, 2, 3) can't be
checked against a breakthrough table the data sources lack.

**Problems:** `measure -- --help` queued 5 min for the lock before rejecting the option (friction report).
