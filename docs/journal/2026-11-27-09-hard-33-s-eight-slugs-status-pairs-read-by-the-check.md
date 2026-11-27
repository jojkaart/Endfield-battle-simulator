## 2026-11-27: Hard 33's eight slugs; status pairs read by the check

**Goal:** two leads on main at a6c425f: Hard 33's slug (7b54 +40.4%, the largest development error; 6339 −12.6%), its
mechanics from the game data and the logs; the status pairs whose replay value a buff's edge put off (1d91, 7b54,
a7a7, e989, 7910, abfd), beside an agent on holds and Rossi's bleed (its files untouched).

**Found:**
- **The slug is eight slugs** (docs/open-problems.md "Hard 33's Woodcraft Slugs"; scripts/probes/targets/slugs.ts):
  both totals are 9.600 Max HP (eight of 1.2), the kills fall at whole slugs of damage (6339: 1.00, 3.00 with two at
  one ms, 4.46, 5.00, 6.00, 7.00, 8.00), one key at one ms at several values (7b54 17 times), and the stage's own text
  says "They are legion" (one slug unshielded at a time, its death unshielding another). The data's number shield
  zeroes a shielded slug's hits (−9999 in the product zone): no log has a zero hit. ZMDLogs lists every slug's debuffs
  under the one id (7b54's attack 1 at 5.27 / 10.99 s: one listing, ×1.198 apart = Jade Vessel × Camille's 0.07), so
  "debuffs that don't act", the partial purges and the non-round factors were other slugs' debuffs, and the purges
  kills. The slugs' own buffs and AI aren't in the data.
- **The status pairs, case by case:** 1d91 (the game's burst after Arcane's combo touch, its listing has Doubles) and
  7910 (held by Arcane's own ultimate stop at +0 ms) on the other side of a buff's edge; abfd held 2.55 s (76 frames);
  a7a7 not an edge: Liino's Medicant ×4, an unjudged kit buff the burst's listing lacks; e989 not an edge: the replay
  keeps Camille's Firefang Weakness 69.19–89.32 s (open); 7b54 the slugs.

**Done:**
- 6339 and 7b54 marked `severalTargets` with that evidence (their own row with 9c6e: a reclassification).
- **`logged-purges` `log-kills`** (default; enginecheck.ts killPurges): in a several-targets fight the replay's enemy
  sheds the team's debuffs at each logged kill.
- **`status-pairing` `check`** (default): a pair fits too by the check's primary reading of it (enginecheck.ts
  primaryParts, now shared with readingBasis), with the landing's modifiers or the replay's at the logged hit's frame,
  and a pair that fits only there is read there by the check (BuffReplay.statusInputs); STATUS_WIDE_FRAMES 60 → 90.
- tests/slug-targets.test.ts, tests/status-pairing-check.test.ts; damageOptions exported from the engine's barrel.

**Scoreboard** (`npm run snapshots:update` against a6c425f): development (29 fights) plain 82.7 → 83.9%, mismatch 5.8 →
4.8%, mean |damage error| 2.9 → 1.2%, |matched| 2.16 → 1.35%, replay-only 2.83 → 1.12%, log-only 1.60 → 0.57%; of it the
reclassification alone (measure's plain tree) plain 83.8%, 4.8%, 1.2%, the readings +0.1 plain. Hold-out plain 82.7 →
82.9%, mismatch 5.4%, |damage error| 6.3%, replay-only 2.69 → 2.62%, log-only 4.79 → 4.70%: 3 better, 1 mixed (plain +3,
its total moved), none worse. Earlier pending plain 81.8 → 81.9%; verified 78.4 → 78.5% (b7b3). Several targets (3
fights) 48.1% plain / 20.6% for 9c6e alone → 54.1% / 20.0%. Better: 1d91, 4360, 7910, 79cc, 8915, 9847, 9c0b, c83c, e989,
012a, 9555, a7a7, b6aa, c6d8, d774, e82d, b7b3, 7b54 (plain 1 → 65, +40.4 → +15.7%); mixed (plain up, a total 0.1–0.3
points further): c779, f978, 3aa6, abfd, c3c7, 9c6e (plain 200 → 244, −20.6 → −24.5%: the second target's log-only no
longer cancelled); worse: af7b (total 0.7 → 0.8%, a burst now paired at a slightly other value), 6339 (plain 114 → 108,
−12.6 → −19.7%: the slug after its 20.37 s kill had Camille's Susceptibility). No simulation reads either assumption
(log check only): no team-ab.

**Decisions:** a fixture mark and a kill purge, not a shield model: which slug a hit lands on is in no log, and the
listing can't say a slug's debuffs; a kill is the one moment the log says the target changed. `check` reads a pair at
the logged frame only where the landing's own frame doesn't fit and the logged one does (the assumed → plain bursts of
b7b3, c779, c6d8: Arcane's WILL burst line a frame off): the log's time is the burst's.

**Left:** e989's Camille Firefang Weakness (replay-only run 69–89 s); per-target state for several-targets fights;
the slugs' replay-only landings (hits on shielded slugs).
