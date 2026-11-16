# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 89 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

## 2026-11-16: Improvement round 1: friction reports to tools, docs and engine records

**Goal:** the owner's standing workflow (docs/friction/README.md): read the
eight friction reports of the day, find the common causes, implement the
improvements. Rule tooling (driver, noise, pools) was phase 2's, in parallel.

**Done** (summary and measurements: docs/friction-done/2026-11-16-round-1.md;
each report's per-point outcome at its end in docs/friction-done/):

- premerge: every step to the end, a pass/fail table with times and the
  slowest tests, a re-run of files that only timed out, a lock shared by all
  worktrees (scripts/premerge.ts).
- Sandbox: the command shapes that work, a git-ignored `scratch/` that
  resolves `@efsim/*`, a template (CLAUDE.md, scripts/scratch-template.ts).
- Hold-outs in fixtures/holdout/ (moved by id, unread);
  `efsim zmdlogs list` never lists them; check/hits/raw/import refuse them.
- `efsim zmdlogs hits` (per-hit records, JSON Lines, workers),
  `efsim zmdlogs raw` (cached raw details), importer keeps effect sources and
  Stagger origins (new imports only), `efsim gamedata tree / who`, an enum
  table and "What the data can't tell" (game-data-format.md).
- Engine: `OWN_HIT_SEES` table (combat-mechanics §3.8, a test per row);
  infliction appliers, a landing's cast, a buff's maker, `keepInputs` and
  `recomputeHit`; state queries exported from timeline.ts; `statLabel`.
- CLI `--kit <file>`, `--duration` on simulate and search; `npm run bench`,
  `npm run merge` (rebuilds the built journal), `npm run prune-unused`;
  tests/helpers/; snapshots readable mid-merge; stdout for must-see lines.
- main.ts is a thin entry running the checkout check before cli.ts loads
  (its own commit, droppable if phase 2 edited main.ts).

**Decisions:** no eslint plugin for unused imports (main's node_modules
would lack it until reinstalled, breaking every worktree's lint): a script on
TypeScript's own fixes instead. Older fixtures keep their fields (no mass
download). No number changed: examples, kits and verified-log snapshots
identical, all 67 pending verdicts identical (13 hold-outs by group only);
docs/accuracy.md changed only in labels.

**Left:** docs/friction/2026-11-16-backlog-after-round-1.md (data-file
module, engine core entry, older fixtures, a status tag on modifiers, helper
migration, shard costs, slow tests, paired suite timing, search times).

## 2026-11-16: A payoff-guided rule search (`efsim rules --guided`)

Goal (the owner): the rule search should work like the timeline search
that worked: put together ideal combos and change the rules in
directions that get closer to them, instead of mutating lists at random.
Done (design.md "The guided rule search"; engine policyguide.ts, CLI
guided.ts, rulespool.ts's persistent worker pool, tests/policyguide.test.ts):
- **Ideal combos** from a rules run's hits: windows (an operator's skill
  family with ≥ 2% of the damage), multipliers (each modifier's kit
  buff, Stagger, a status) with who gives them (the owner's press that
  created the buff), each missing multiplier's loss (its modifiers from
  a hit of the same kind added, the zones recomputed), the window's ideal
  (all at once) and achievement; the visible cues each window comes with
  (Twilight, hovering, Solidification).
- **Directed edits** for the six biggest losses: hold the giver for the
  window's cue, chain the two ultimates, start the window when the
  multiplier is visibly up, save SP, `shows` on changing buttons (the
  n-th press of a button its n-th skill), spare SP, move up; merged pairs
  of the best screened edits; four random moves; a widened round (14
  losses) before stopping.
- **Judged on common seeds**: 6 seeds to screen, the best four on 32,
  close calls on 64; kept beyond 2 standard errors and 0.2% and positive
  on the non-screening seeds; then the analysis again; the final list
  against the start on 32 fresh seeds.

Results (design.md table; team pages' Rules): no example changed. The
owner's team: Estella's ultimate only while Staggered +1.70% ± 0.80
(fresh +1.20% ± 0.66) but −0.94% ± 0.47 from zero. Typhoeus's: Arcane's
ultimate only while she hovers +1.40% ± 0.52, fresh +0.57% ± 0.79. Ink
Melt: nothing kept on the example; from the list before today's
Twilight hold it found `shows` on rule 7 (Si's battle skill before
Ardelia's combo; +3.10% ± 1.02, fresh +2.18% ± 0.87). On the example
that edit is +1.52% ± 1.42 on seeds 1–32 (missed) but +3.93% ± 0.77 and
+2.54% ± 0.86 on two sets of 64 fresh seeds, and −3.27% ± 1.26 from
zero: not taken, like the owner's team's. **The Twilight hold measures
−0.11% ± 0.71 on 64 fresh seeds**: the +4.1% of the entry below was its
10 seeds. Both full-energy gains losing from zero led to `--also <zero
scenario>` (an edit kept only if it isn't worse there), added after the
runs and not yet run on the three teams. Runtimes 7–25 min a team
(42–70 edits, 3 workers).
Decisions: the windows come from the rules run (the engine's own
modifiers on its own hits), not the payoff table's planning-fight
probes (cheaper; what the team really puts on each window); a flag of
`rules` (same inputs, a list out, like `--search`); the bar on the
non-screening seeds, because the best of 20–30 six-seed screens is
biased up (gains roughly halve on the confirm seeds).
Problems: the noise. A held ultimate moves every later event, so a
paired difference's standard error is 0.5–1.2% at 32 seeds and most
structured edits gain 0–2%: the bar, not the ideas, limits the search.
The ideal combos are loose upper bounds (achievement 39–71%: Stagger on
every hit can't happen); uptimes and cooldowns aren't modelled in them.
Inflictions a hit consumes and SP for empowered skills aren't
multipliers here (they're in the hit's scale, not its modifiers).

## 2026-11-16: Friction reports after every sub-agent task

The owner, after the architecture review: make that kind of analysis part
of the default workflow. Every finished sub-agent is resumed once to write a
friction report (structural problems in code, repository, docs or tools
that slowed it, with suggestions complete enough to act on alone) into
[docs/friction/](friction/README.md); when about five unprocessed
reports collect, one sub-agent reads them, implements the common
improvements and moves them to
[docs/friction-done/](friction-done/README.md) (the owner: keep the
first folder for what still needs doing). Rule in CLAUDE.md "Friction
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
both: 54,771 against 52,561 sustained (+4.2% on seeds 1–10; +2.6% ± 0.5
paired on 64 fresh seeds, checked afterwards), from zero
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
