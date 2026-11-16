# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 87 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

## 2026-11-16: Friction reports after every sub-agent task

The owner, after the architecture review: make that kind of analysis part
of the default workflow. Every finished sub-agent is resumed once to write a
friction report (structural problems in code, repository, docs or tools
that slowed it, with suggestions complete enough to act on alone) into
[docs/friction/](friction/README.md); when about five unprocessed
reports collect, one sub-agent reads them, implements the common
improvements and moves them to `processed/`. Rule in CLAUDE.md "Friction
reports". First reports requested from the agents that finished today
(rules phase 1 and 2, Si's Haste, Arts Intensity, docs workflow, test
speed, data cache).

## 2026-11-16: Game-data cache; worktrees without `source`

Architecture review items 1 and 7. **Cache:** `loadGameData` keeps a
v8-serialised GameData in the main checkout's `node_modules/.cache/efsim`
(packages/data cache.ts; design.md "Data layer"). The key hashes the
sources' commits and table stats, the kits, schemas, tables.json, the
data package's sources and the engine modules it runs (traced from its
imports: 11 of 43 files, not the planning code, so policy edits keep the
cache; an untraceable import falls back to the whole engine). Atomic
writes, any read error rebuilds, `EFSIM_NO_CACHE=1`, `efsim cache [clear]`.
Tests: a cached load and the worker's shared data equal a fresh build
(a tampered entry fails it), kit/loader/engine/schema edits change the
key. Measured under load 11–15 (no cache → cache): `efsim find` 12.5 →
1.1 s, `simulate` 17.7 → 1.5 s, one test worker 16.5 → 2.7 s, `efsim
rules` (Ink Melt, 300 s × 5 seeds) 55 → 47 s (the rest is the rule run).
v8 rather than JSON: it keeps shared objects shared, `undefined` and
NaN; deserialising takes ~0.1 s. Comparing `v8.serialize` bytes of a
fresh and a read copy is no equality test (string representations
differ), so the test uses `isDeepStrictEqual`. **Worktrees:**
`node scripts/setup-worktree.ts` links node_modules/@efsim (the .sh only
calls it); the vitest configs run it and alias `@efsim/*` to the
checkout's own packages; tsconfig `paths` does the same for tsc; the
data loader reads the main checkout's data/ when the worktree's is
empty; the CLI exits with a clear message when an @efsim package
resolves outside its checkout. Limit: when the other checkout lacks an
export the CLI imports, Node fails at link time (a SyntaxError naming
the export) before the check runs; loud, but less clear.

## 2026-11-16: Faster tests, snapshot regeneration, accuracy scoreboard

Architecture review items 2, 5 and 11. **Tests:** buffreplay.test.ts was
split into three files and search.test.ts into two. The six single tests
of 25–60 s (whole log checks on 3f78, 4a64 and 4e5e, and `efsim search
--loop` output) moved to tests/slow/log-cases and search-loop-cli. No
assertion was dropped. test:logs now runs 3 workers and the pending logs
in 4 shards, because a log's check time doesn't follow its hit count
(340 hits can take 59 s). `npm test`, base and branch back to back at
load 11–12: 629 s with 2 timeouts (exactly the moved tests) against 380 s
passing. At load 3–5 the base took 383 s. **Snapshots:** `npm run
snapshots:update` (scripts/snapshots.sh) empties every snapshot and writes
it again, so the result doesn't depend on which side of a conflict was
taken. It restores the files if a run fails. **Scoreboard:**
[accuracy.md](accuracy.md) comes from the verdict snapshots and
holdout.json (scripts/accuracy.ts; a test keeps it in step). First
numbers: development 31 fights, plain 47.2%, mismatch 19.8%, mean |damage
error| 15.8%; hold-out 13 fights, 62.1%, 7.6%, 13.5%; verified 6 fights,
71.0%, 0 mismatches, 1.7%. The fit measure for "better/worse": plain
matches, mismatches and |total damage error|. Hold-outs count only in
totals. It is used in the pending check's failures and shard summaries,
in `--compare <ref>`, and at the end of premerge.

## 2026-11-16: Journal entries as files; a one-screen roadmap

Architecture review item 6: the journal and the roadmap were 8 of the 16
recorded merge conflicts and most of the 21k words of session-start
reading. Now each entry is its own file, docs/journal/YYYY-MM-DD-NN-slug.md
(NN orders one date's entries), its first line the heading as before.
`npm run journal` (scripts/journal.ts) builds docs/journal.md (the last 10
entries) and docs/journal/README.md (an index of all); `npm run check`
starts with `journal:check`, and premerge wants a new entry file, not a
journal.md change. `npm run journal:new -- "Title"` starts an entry;
`npm run journal:adopt` turns entries written the old way (a conflicted
docs/journal.md, or `-- --from MERGE_HEAD`) into files, matched by heading.
All 83 entries converted, the archive's too (one format, one index, and
the adopt step can tell every old entry by its heading); the conversion
reproduces the old text exactly (links rebased to docs/journal/). The
roadmap is one screen; its old text, unchanged, is in roadmap-details.md.
Session-start reading (CLAUDE.md, README, journal, roadmap): 21.2k words
→ about 4.6k. The built files still conflict when two branches add
entries; that's resolved by rebuilding, never by hand.

## 2026-11-16: Architecture review

The owner asked for an analysis of the whole architecture and how it
could help development: [architecture-review.md](architecture-review.md)
(read-only; prioritised table at the top). Measured: `npm test` 308 s
under load (two files make 45% of the summed time), every CLI call or
worker spends 9–11 s building the game data (42% of a profile of three
300 s rule runs; `efsim find` 9.1 s), and most of a rule run is asking
whether a press can start (frame-by-frame stepping, state copies).
Top items: a cached GameData, test rebalancing, rule-run invariants, a
button model in the engine (the End Stance class of bug), event-driven
rule stepping, assumption toggles and an accuracy scoreboard. No code
changed.

## 2026-11-16: Ink Melt's one-off surge at 80 s

From the rules' damage graph (artifact "Rule Rotation Damage") the owner
asked why Ink Melt surges around 80 s once. Laevatain's Twilight battle
skill hit 78–96k there against 32k elsewhere: Si's ultimate's Heat Amp
×1.36, a Stagger ×1.3, Wulfgard's and Ardelia's debuffs lined up on
Twilight by chance. Not a bug: the list fired each ultimate when ready,
so their cycles drift. Holding Si's ultimate for Twilight (or Laevatain's
ultimate ready): 68,609 against 65,922 sustained (+4.1%), from zero
63,719 against 61,962; now the example. Dead ends: also holding
Wulfgard's (no gain, more delay-sensitive), holding Laevatain's ultimate
for a Stagger (−9%), saving SP for Twilight (0 / −6%). New cue: how full the
enemy's Stagger bar is (rank 3; the rule search now tries it and "not
Staggered"). Laevatain's ultimate held until the bar is 50 / 70 / 85%
full: 66,833 / 64,079 / 64,253 (with Si's ultimate on Twilight only at
70%: 67,950), all below 68,609: waiting costs one of her five ultimates
in 300 s. A bot gains from it (50%: 73,927 against 69,521), a 0.3 s
player doesn't. For the rule
search: moves that add a condition on another operator's visible state
to an ultimate rule (it found none of this itself).

## 2026-11-16: Liino's rule in Typhoeus's team pressed End Stance

The owner noted Liino goes straight from Vocalist Stance to her ultimate
(the kit already allows it). The graph of the rules showed End Stance
presses anyway: rule 7 ("Liino not in Vocalist Stance: Arcane's battle
skill, then Liino's") also fired during Cosmovoice, and its queued Liino
press resolved to End Stance when her button had changed (once at 3 s,
before her first ultimate; three times cutting Cosmovoice short). New in
the rule format: a press's `"shows"` (only if the button shows that
skill, else skipped); Liino's Cosmovoice is a visible cue. Rule 7 with
both: 54,771 against 52,561 sustained (+4.2%, same seeds), from zero
50,178 against 49,964. Left: one Arcane battle skill at 0.3 s is still
wasted (her stance shows only when her first projectile lands).

## 2026-11-16: Is the Arts Intensity handling right? (yes; one Breach fix)

Goal (the owner): check the engine's Arts Intensity against the logs and
the data, since `efsim gear --rules` puts Estella on Grizzled Edge
Gauntlets (+3.7%) for their Arts Intensity line. Done (combat-mechanics
§3.7, open-problems "Arts Intensity"):

- **Inventory:** damage × (1 + AI/100) on bursts, reaction hits,
  Combustion ticks (snapshotted), Lift / Knock Down / Crush / Breach hits,
  "Crush DMG" skill hits and Shatter (damage.ts reactionScaleParts /
  statusScaleParts); strength × (1 + 2·AI / (AI + 300)) on Breach,
  Electrification and Corrosion, the applier's AI at application
  (situation.ts artsIntensity, status.ts); no cap; nothing else. The data
  has no coefficient: every reaction value is a ReadSkillSettingData from
  a table not extracted; the stat hint (AttributeShowConfigTable 87)
  lists exactly those three effects (and Lift Stagger), one value each.
- **Logs:** every status hit of the 79 development logs at its replay
  landing (scratch scripts on engineHits / readingBasis). Exact matches
  across AI 0–287 (bursts, reactions), 0–182 (ticks), 0–163 (Lift),
  119–180 (Crush), 0 and 98.7 (Shatter, Estella); no slope of logged ÷
  predicted on AI. Electrification's logged strength exact at AI 0–287.4,
  Breach's at 31–209. The trigger's AI counts (81 reactions where the
  consumed infliction's applier differs), and Shatter's is the shattering
  operator's (a9d7).
- **Fix:** Breach's own hit saw its own new DMG Taken; the logs show it
  sees no Breach, not even the one it replaces (7e19, d4fb, c4f3 exact
  after). Breach hits plain 0 → 7; pogranichnik-chen example 335,507.5 →
  332,358.6; test in tests/kit-pogranichnik.test.ts.

The owner's team doesn't Breach, so its numbers don't move, and the
Grizzled Edge advice stands: Estella's AI is 0 today, and her Shatter,
Solidification and Lift (23% of her damage in the 60 s example) scale
with her own AI in the logs' range. Left open: Pogranichnik's Breach
strength one Fervent Morale layer off the replay in 12 of 21 instances
(the layer's timing, not the curve). In-game test 3 answered by the logs.

## 2026-11-16: Rule-based rotations, phase 2: gear on rules

Goal (the owner): gear chosen analytically: find what a team's play
leaves on the table, then the gear that fixes it (too much Ultimate Gain
Efficiency on a damage dealer whose ultimate comes faster than the
supports' it needs). Done (design.md "Rule-based rotations": common
random numbers, crits as a distribution, "Diagnosis, marginal values,
gear on rules"):

- **Common random numbers**: a rule's k-th cue onset draws its delay from
  (seed, the rule's cue and presses, k) only. Owner's team, 10 seeds, sd
  of a per-seed difference: a gear change 64 (independent seeds 4,006);
  two rules swapped 1,097 against 3,174 (the old shared stream 3,836).
  Stratified (Latin hypercube) draws: no clear gain over 20 replicates,
  dropped. Seeded numbers in the docs re-drawn (the owner's list now
  57,096 sd 1,402; Ink Melt 65,922; Typhoeus's 52,088).
- **Crits as a distribution** in `efsim rules` (the lead's addition):
  each run's crit spread from each hit's chance, combined over seeds by
  the law of total variance; mean, sd split delays / crits, 5–95%. Crits'
  sd is 350–380 DPS on all three teams, delays' 550–2,900; none of the
  three has a crit-triggered effect (the code falls back to rolled crits
  for those that do). Replaces the rolled-crit runs.
- **`efsim diagnose`** (engine policydiag.ts, an observer of
  `playRules`; engine statistics `energyGained` by source, `energySpent`,
  `spOverflow`): energy gained / spent / wasted / held (balances), time
  with an ultimate ready but not cast by why, combos lit but unused, SP
  at the cap, other operators' buffs and enemy states on the main damage
  dealer's hits, shares; **marginal values** per operator for one
  gear-line-sized step of each stat the game's T4 gear offers (a fifth
  synthetic piece, paired on common seeds; noisy ones taken to 16
  seeds); findings in plain words.
- **`efsim gear --rules`**: loadouts scored by playing the list (8 seeds,
  16 for noisy gains), candidates from the logs plus swaps and set builds
  proposed by the marginal values, coordinate ascent, a change only
  beyond twice its standard error, the result checked on fresh seeds,
  the diagnosis before and after. Workers (rulespool.ts).

Results (examples keep their gear; team pages' "Gear"):
- Owner's team: Estella's efficiency is the owner's example (worth +0.3%
  ± 0.8 a line, Arts Intensity +5.2%); Akekuri's and Arcane's are
  bottlenecks (+2.9% ± 0.9, +1.3% ± 0.6). Estella Heavy Armor + Grizzled
  Edge Gauntlets +3.7% ± 0.1 (a candidate no log or site had), Si the
  logs' LYNX Slab loadout +3.6% ± 0.8, Akekuri Fiber Gloves T1 +1.7% ±
  0.8: together +8.0% ± 0.9 on 24 fresh seeds. A 60-list rule search on
  the new gear found nothing better than the current list (61,293
  against 61,480). Without rule 10 (spare SP to Akekuri) the list sits at
  the SP cap 165 s of 300 (−19%): the diagnosis shows it at once.
- Ink Melt: Wulfgard's efficiency is the bottleneck (+6.6% ± 1.5 a line);
  Bonekrusha Wristband → LYNX Gloves +3.9% ± 1.0 on 24 fresh seeds, but
  −1.5% on the example's 60 s timeline: example kept.
- Typhoeus's team: Perlica's Probe + Hot Work Power Cartridge →
  Calibrator + LYNX Slab +0.87% ± 0.04 (damage only), +0.3% / +0.6% on the
  60 s rotations: example changed (5,774,076 / 5,019,331; snapshots
  updated). The ascent's biggest gain, Arcane on the logs' Hot Work
  loadout (+5.9% ± 0.7, 24 fresh seeds), flips her to INT mode (Intellect
  813 / Will 363): left to the owner; gear --rules now flags mode flips.

Decisions: a separate `diagnose` command (its ~300 runs need workers,
and gear --rules reuses it); the marginal values' steps are the game's
median T4 line sizes; a change is confirmed on fresh seeds because the
ascent's best-of-many gain is biased up (Ink Melt: +7.3% in the ascent,
+2.1% / +3.9% on fresh seeds). Problems: stats that move the timeline
(Ultimate Gain Efficiency, mode-flipping attributes) stay noisy on common
seeds (±1–2% a line at 4 seeds) while damage-only stats are exact to
±0.1%; the ascent is path-dependent where gains are within that noise (a
first owner's-team run took Akekuri's change first, a second Si's).
Runtimes (4 cores, 3 workers): diagnose with marginal values 3–4 min a
team; gear --rules 18–20 min a team (1,000–1,150 runs of 300 s).

## 2026-11-16: Does Si's Haste need Initial Stroke? (the data: yes)

The owner doubted that Si's talent Haste comes only on the Inksoul path
(the kit gives it when the Inksoul ends). BuffData creates
talent1_speedup in two places only, both on that path:
xianjing_linkline (the Inksoul) at its finish and xianjing_inkboom
(Final Stroke) while the target has Artful Intent; Artful Intent's own
end without an Inksoul (xianjing_inkhurteffect buffEvent 2, the inkmark
projectile) creates none. The kit was right; its notes now cite this,
and tests/kit-si.test.ts pins the three paths. The logs can't check it:
ZMDLogs records no Haste (four raw details fetched to the scratchpad:
2 Final Stroke, 4 Inksoul-expiry, 3 no-Inksoul ends, no speed-up buff),
and fixtures keep only buffs with damage effects. In the 39 non-hold-out
Si fixtures: 26 bursts without an Inksoul, 56 with (22 look like Final
Stroke, 4 are expiry by the raw log's `poiseDamage.orig_source`, 30 at
expiry can't be told apart from a late Final Stroke without the raw
log), 20 Artful Intents with no end logged. The raw detail's
`orig_source` tells the paths apart (normal_skill_2: Final Stroke;
normal_skill_inkmove_2: the Inksoul expiring). It matters: for the
owner's team, Initial Stroke right after the battle skill is +3.0%
(56,423 against 54,760, 10 seeds) with the data's reading and −3.0%
(55,883 against 57,630) if every burst gave Haste. In-game test 109
asks the owner to look for the icon.
