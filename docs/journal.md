# Journal

<!-- Built by `npm run journal` from docs/journal/*.md: edit the entry files, not this file. -->

A concise record of each working session: what was attempted, decisions and
their reasons, dead ends, and anything a future session should know. Newest
entry first; this page shows the last 10. All 96 entries: [journal/README.md](journal/README.md).
Each entry is a file under docs/journal/; add one with
`npm run journal:new -- "Title"`, then `npm run journal` (CLAUDE.md "Journal and roadmap").

## 2026-11-18: The replay follows the log's Stagger windows

Goal: why the replay's Stagger windows don't line up with the logs'
(Perlica's ×1.3–1.5 runs, 9090's 145 against 208 hits under Stagger,
the snapshots' "staggered hits" errors), and a general fix.

Found: the starts mostly agree; the replay's windows end early, 0.4–12 s
before the log's last Staggered hit (median 3.5 s over 34 windows), and
then the next logged Stagger hit (listed at bar 0 with Stagger dealt)
broke the replay's bar again for a full new window past the log's end.
The damage sides with the log: 597 hits it lists as Staggered and the
replay didn't are ×1.30 (median) the replay's reading, 214 the other way
×0.77. No logged hit falls between a breaking hit and the first one that
lists Stagger.

Done: the replay follows the listing as it follows the bar
(buffreplay.ts `loggedStaggerSteps`; engine `holdStagger`): Staggered
through each listed moment to the next listed one, not Staggered at a
moment that lists none unless a hit there breaks the bar; a log with
bars and buff lists but no Stagger anywhere never Staggers (7b54's slug).
The replay's window tracking keeps one window through a stop that moves
its end (it split them), and `BuffReplay.staggerSpans` / `staggerHolds`
say where the windows were and where the engine's own Stagger would
have ended. Scoreboard (`npm run snapshots:update`): development plain
47.3 → 48.5%, mismatch 19.8 → 19.6%, mean |damage error| 15.8 → 14.9%
(16 better, 1 worse: f978 −3.5 → −3.7%); hold-out plain 62.1 → 63.6%,
mismatch 7.6 → 7.5%, 13.5 → 13.1% (6 better, 1 worse, 2 mixed); earlier
pending plain 45.1 → 45.9%. 9090: Liino −15.0 → −10.4%, Perlica −13.0
→ −10.7%, the fight −5.4 → −2.1%. Damage totals moved away from 0 in
458b (2.2 → 3.2%), c6d8 (32.9 → 36%), 4360 (8.1 → 8.4%): their plain
matches rose, so the added ×1.3 hits are right and the excess is
elsewhere.

Decisions: follow the log rather than lengthen the engine's Stagger, as
nothing found explains the extra length (the engine stays on the data's
PoiseRecTime plus stops and freezes); the teams don't move (52,369 /
53,781 / 63,347 rerun, unchanged). A flat +3.5 s on the engine's Stagger,
tried as a sensitivity: −1.2% (the owner's team), +0.7% (Ink Melt),
−0.2% (Typhoeus's), within the noise. In-game test 110 times a Stagger.

Dead ends (open-problems.md "The replay's Stagger windows"): a ZMDLogs
listing lag, Stagger dealt while Staggered, target hit-stop sums,
Finishers, Lifts, the modelled stops, the Slow status (movement). Left:
Liino's volleys (10 logged, 1 replayed in 9090: her kit's trigger
reading), Perlica's runs (her mismatches stay where log and replay agree
on Stagger: her kit), 4e5e's unattributed Stagger (68 over 53.2–55.4 s,
two steps not whole numbers), whether a Stagger starts the frame after
the breaking hit (~20 hits, mixed damage).

## 2026-11-17: Haste is movement speed; the owner's team drops Initial Stroke

**Goal:** settle what Si's talent Haste does after the logs found it doesn't
speed up attacks (docs/journal/2026-11-17-01-tests-18-19-101-104-from-the-logs-bosses-freeze-haste-isn-t.md),
and whether the owner's team should still press Initial Stroke.

**Done:**
- The owner (2026-11-17) has never noticed Haste in play and would notice
  faster attacks. The game's own glossary entry for Haste (I18nTextTable_EN,
  the `ba.speedup` term) reads "Temporarily raises the movement speed of a
  target … Effects of the same type can stack until hitting the speed cap";
  Slow is its opposite ("movement speed reduction"). So Haste is movement
  speed, which the simulator doesn't model: settled by the data's text, the
  logs (test 19) and the owner.
- In-game test 109 (does the Haste need Initial Stroke) moved to the bottom
  of the queue: it matters only if Haste shortened cooldowns, which nothing
  suggests.
- The owner's team's rule 9 now presses only Si's battle skill (no Initial
  Stroke). `efsim rules … --compare` against the old list: +1.37% ± 0.58 on
  64 fresh seeds at full energy, +0.66% ± 0.52 from zero (noise), one press
  fewer. On seeds 1001–1032: 53,781 (sd 1,194) / 52,740 (sd 1,539), against
  52,382 / 52,716 with Initial Stroke (docs/teams/estella-si-akekuri-arcane.md).

**Left:** the `hasteFrames` plumbing in the engine is now inert (a cleanup
for a later round). No other rule list in examples/ presses Initial Stroke.

## 2026-11-17: Tests 18, 19, 101, 104 from the logs: bosses freeze, Haste isn't attack speed, teammates' pause

Goal: the owner can't record tests 18, 19, 101 by hand and answered 104
from play (most bosses freeze, a few rare ones don't); decide what the
logs can (development logs only).

**104.** Bosses freeze by default now; control immunity is per enemy, in
a table with the log evidence (packages/data/src/enemyFacts.ts, read into
EnemyData.controlImmune: the data has the tag on no enemy, so it's a data
fact from the logs, not an engine rule). Each boss with a freezer, checked
frozen against immune: Rhodagn's five logs don't move (he freezes),
Chiliarch (c3c7: Ardelia's Susceptibility held too long) and the enemy Si
(4a64: Arcane's WILL debuff held too long; 3f78 leans the other way) are
listed immune. Under both readings Si's own debuffs are held, so her
Artful Intent ends (the 2026-11-13 evidence) don't tell them apart. Not
per fixture: fixtures are being refreshed in parallel, and immunity is the
enemy's. Scoreboard unchanged in every group.

**18.** Cooldowns run through others' ultimate stops: settled (58 combo
pairs come back between the cooldown and the cooldown plus the stops,
e.g. Typhoeus 17.1 s apart, cooldown 17 s, 4.9 s of stops in 9c6e).
Estella's Physical Susceptibility held by her own stop fits c4f3 (5 of
6). Laevatain's Twilight isn't decided (her logged Twilight ends run
2.5–7 s past the simple model): registered as kit assumption
`laevatain-twilight-own-stop` (reading `held`, +2.03 s).

**19.** Haste doesn't speed up attacks: basic-attack steps in the 5 s
after Si's Inksoul ends (30%) are 0.995× as far apart as elsewhere (95%
0.95–1.02; sped up, 0.77). The engine no longer plays hasted casts faster
(clock.ts actionSpeed is 1). It broke the five Si example timelines,
which had been searched with hasted casts: each now has the better of
the old timeline repaired (the gear ascent's repaired replay: steps
moved later or dropped) and a fresh single-beam search, a lower bound
(owner's 3.99M → 3.47M repaired, from zero 3.26M → 2.29M searched; Ink
Melt 4.75M → 3.95M repaired, from zero 4.72M → 2.84M searched, beam 48 no better; Si, Laevatain,
Liino, Gilberta 3.08M → 2.60M searched). A full re-search (beams
12/24/48, skeletons) is left: hours of CPU.

**101.** Not one timer: two thirds of full chains run straight on, the
rest wait a heavy-tailed pause (median 3.7 s); the share of free time a
teammate attacks depends on the fight and the operator (R² 0.41 each),
not on Stagger or the parser. Measured the same way, the engine's
teammates attacked 0.59–0.66 of their free time against the logs' 0.43
(median per operator-fight): the old 3.5 s was the median of the gaps
over 1.5 s alone. Pause now 6.5 s (0.41–0.45). The log replay plays the
logged casts, so only the examples and the rule numbers see it.

Rule numbers (32 fresh seeds, sustained DPS, full / from zero; docs/teams):
the owner's team 56,493 / 56,055 → bosses freeze 56,716 / 56,141 → no
Haste speed 55,278 / 55,598 → pause **52,382 / 52,716**; Ink Melt 69,668
/ 61,716 → 69,698 / 62,331 → 61,255 / 57,302 → **63,347 / 56,123**;
Typhoeus's team (no freezer, no Haste) 54,607 / 51,076 → pause **52,369
/ 48,967**. All three fight Rhodagn, now frozen by Si's battle skill.
Scoreboard (docs/accuracy.md): bosses freezing moves no group; Haste
without cast speed: development plain 47.2 → 47.3% (79cc +26 plain, 458b
+4, 791 −3 plain but damage −18.4 → −17.6%, a7a7 −2), mismatch 19.8% and
mean |damage error| 15.8% unchanged; hold-out 62.1 / 7.6 / 13.5%
unchanged. The pause doesn't reach the log replay (it plays the logged
casts).

Dead end: the old 3.5 s's "40% of free time" didn't reproduce with the
same measure on the engine. A scratch measure had a units bug (time stops
in frames compared with ms), harmless since both sides had it.

## 2026-11-16: Older development fixtures refreshed from fresh battle details

Goal (the lead; backlog after round 2, point 3): give the 79 development
fixtures imported before 2026-11-16 what newer imports keep, from a
one-off fetch of their raw details the owner approved.

Done:
- `efsim zmdlogs refresh <fixture>` reads the cached detail when
  `--detail` is omitted, else fetches it once (`refreshFromDetail`,
  zmdraw.ts). `refreshFixture` now rebuilds the hits as an import would
  (`zmdlogsHits`, factored out of `zmdlogsToFixture`) and adds every
  field the fixture lacks: casts, poise, poise.origin and, new, effects'
  and boundaryEffects' `source` / `since`, one provenance note per kind.
  The rebuilt hits must equal the fixture's but for those fields, and
  logged casts the detail's; otherwise `RefreshMismatch` and nothing is
  written. Tests on synthetic details (tests/zmdrefresh.test.ts,
  tests/helpers/zmdlogs.ts).
- Import against refresh, compared: everything an import records from
  the detail is now covered. Not refreshed, as they come from elsewhere
  or feed the computation: the team (the export, a second request), the
  enemy level (stage or total damage; where the stage names the boss,
  its level is every fixture's), the import's notes, `verifiedAgainst`.
- The fetch: 79 details, one request each, 3.5 s apart, all found, no
  parser version changed. 77 fixtures refreshed (6 multi-target ones also
  got casts and Stagger); every other field is as it was (checked against
  HEAD), and no string other than game keys and the notes was added.
- `npm run snapshots:update`: no snapshot and no scoreboard number moved
  (the fields are record-only).

Skipped: 40d9 and 4e5e (verified). Each detail now lacks a zero-length
buff lane at one hit that the fixture lists as unquantified (40d9's lane
is still there, with its dynamic effects emptied; 4e5e's is gone).
Damage and hit counts match, but the brief said not to overwrite a
detail that differs. ZMDLogs can change a stored detail
(data-sources.md).

What the new fields answered (open-problems.md): Electrification's
logged giver is the replay's applier at 3,497 of 3,505 kit hits (the 8
others in 3aa6), and the level readings that differ are in 3aa6 and
d774. Breach can't be checked from the hit export (it lists no physical
statuses). Of 79 Artful Intent bursts, 39 are credited to Final Stroke
and 33 to an Inksoul expiry; 7 deal no Stagger and record no path.

## 2026-11-16: Improvement round 2: package boundaries, CLI commands, design.md split

Goal (the lead): the larger restructures of the architecture review
(12–14) and the open friction points, behaviour-preserving throughout.
Summary: docs/friction-done/2026-11-16-round-2.md.

Done, one commit (or two) per item, in order:
- **Quick wins:** `npm run lint:changed`; premerge skips the suites when
  typecheck or lint fails; the game-data cache keys only on what the
  build runs and says why it rebuilds; `framesOf` / `withSeconds`;
  `node scripts/with-lock.ts`, `scripts/at-commit.ts`, a per-file
  progress reporter for background vitest runs; one snapshot writer and
  `scripts/snapshot-keys.ts`; status tests on `toMatchObject`;
  `PolicyObserver.check` / `.press`; pending shards balanced by measured
  time (longest shard 79 → 54 s of check time).
- **CLI:** one module per command (`packages/cli/src/commands/`); the
  usage text is byte for byte the old one.
- **Engine:** `core.ts` (`@efsim/engine/core`) and `planning/`, with
  lint-enforced boundaries; the data package imports only the core.
- **Logs:** `packages/logs` (`@efsim/logs`), the logcheck ⇄ enginecheck
  cycle broken; `efsim zmdlogs` is a thin wrapper.
- **Docs:** design.md is the principles and an index; the sections are in
  docs/design/; `npm run links` (and a test) checks relative links.

Checks: after every item `npm test` passed and 42–48 CLI invocations gave
the same output as 1de265e (scratch/at/, `scripts/at-commit.ts`), apart
from timings and the provenance line. `npm run snapshots:update` after
item 4 left every snapshot and docs/accuracy.md byte for byte as they
were: the scoreboard didn't move.

Decisions: the planning code moved into a folder (a visible boundary,
simple lint globs) while the core stayed where it was, so tests' deep
imports into timeline/* still work; `@efsim/cli` re-exports `@efsim/logs`
so older imports work; setup-worktree now also links a new workspace
package in the main checkout (packages/logs), so main runs after the
merge without `npm install`. Not done (carried to
docs/friction/2026-11-16-backlog-after-round-2.md): one module for data
file reads, facts on status landings, a structured status on modifiers,
the test-helper moves, the SP anchor, search-time tables.

## 2026-11-16: Rule numbers refreshed for the fixed driver; Ink Melt re-tuning finds nothing

Goal (the lead): after the rule driver's fixes (one start check, event
stepping), refresh the documented rule numbers, and win back Ink Melt's
−2.4% from zero if a change holds up.

Done:
- `efsim rules --first-seed n` (default 1): the report on fresh seeds.
  The three team pages' "Rules" tables, design.md's results table and the
  example lists' descriptions now give 32 fresh seeds (1001–1032), full
  energy and from zero. The old 10-seed numbers are marked superseded in
  one line. The owner's team: 56,493 / 56,055; Ink Melt: 69,668 / 61,716;
  Typhoeus's: 54,607 / 51,076. Against the fixed 300 s search: +21.1%,
  +27.4%, −3.2%.
- The owner's page: Initial Stroke's +4% was the old driver's. Now
  leaving it out is noise under the data's reading and +2.8% ± 0.6 under
  test 109's alternative (`--assumptions`), so test 109 decides it.
- Ink Melt: neither guided search kept an edit: the default one, judged
  on the zero start too, and one led by the zero start. Nor did a short
  random search. From zero the best edit was noise (+1.2% ± 1.2) and lost
  6.6% at full energy. The example list stays (team page).

Also: the friction report of phase 2
(docs/friction/2026-11-16-phase-2-friction.md).

## 2026-11-16: Rule driver phase 2: button model, one start check, event stepping, run checks, assumption switches

Goal: phase 2 of the [architecture review](architecture-review.md)
(items 3, 4, 8, 9, 10) and the rule-noise points of the three friction
reports on rules, gear on rules and the guided search. Done (design.md
"Rule-based rotations", its "Assumption switches"):
- **Button model** (engine timeline/buttons.ts): what each battle, combo
  and ultimate button shows and casts, from the kits' `available`
  conditions, follow-ups and own combo windows. A press casts that skill
  or nothing; `shows` checks its label. No example button is ambiguous at
  any frame (test).
- **One start check** (`canStartAt`): earliestStart now judges an `at` on
  the state advanced to it. Every disagreement between the old pair
  (startsNow on the advanced state, earliestStart from the last press) was
  SP granted on the way, the dive-landing case included; the old driver
  waited for the stale check, so SP-gated presses came late (Ardelia's
  battle skill 1.7 s). SP is snapped to its regeneration grid, so it reads
  the same however a state was advanced. Property test on the examples'
  rotations and rule runs.
- **Event stepping**: the driver visits the frames where something it
  reads can change (about a third); `stepping: "frames"` is the reference
  and gives the same rotations (test: three lists, several seeds, both
  energies). 1.2–1.7× faster a run (the simulation itself is the floor).
- **Run checks** (`checkRuleRun`): no press casts another skill than its
  button showed, none cuts its operator's own ultimate state (a
  counterfactual without the press), `simulate` replays it; zero on the
  three lists; a constructed End Stance list is caught.
- **Visible states in the kits**: `visible` on kit buffs and stacks
  replaces policy.ts's operator tables; cues unchanged.
- **Assumption switches**: kits register open readings (`assumptions`,
  triggers with `reading`); test 109's alternative is the first
  (`si-haste-every-end`). `--assume` and `--assumptions` on `rules`,
  `diagnose`, `gear --rules`, `--guided`.
- **Noise tooling**: `efsim rules --compare` (paired gain ± SE on seeds
  1–k and fresh 1001…), a seed/power table in design.md, the zero-energy
  companion judged by default (`gear --rules`, `--guided`), one worker
  pool per command (`efsim rules` uses it too), the commit at the head of
  long outputs, the guided search's list written after each kept round.
  Antithetic delays tried: no gain (the owner's
  team: SE 0.17% against 0.14% plain at 128 seeds), dropped.

Behaviour changes (32 fresh seeds, 1001–1032, 300 s; before → after):

| Team | Full energy | From zero |
|---|---|---|
| The owner's | 56,274 → 56,493, +0.39% ± 0.47 | 55,852 → 56,055, +0.36% ± 0.25 |
| Ink Melt | 66,355 → 69,668, +4.99% ± 0.99 | 63,213 → 61,716, −2.37% ± 1.23 |
| Typhoeus's | 54,847 → 54,607, −0.44% ± 0.78 | 50,818 → 51,076, +0.51% ± 0.62 |

All of it comes from earliestStart's fix: the old driver with only that
fix gives the same means (against the new driver: the
owner's team identical on 31 of 32 seeds, Ink Melt +0.01% ± 0.15 and
+0.23% ± 0.23 from zero; Typhoeus's −0.40% ± 0.40 and −0.15% ± 0.09,
presses an SP tie now starts a frame sooner (the snap)). The two moved example scenarios
(akekuri-laevatain, wulfgard-fluorite) are SP ties the snap now reads
exactly. The documented 10-seed numbers on the team pages predate this.

Not done: the review's estimate of 3–10× for event stepping was too
high: after the probes, most of a run is the simulation and the basic
attack's earliest start (it advances copies of the state). The friction
reports stay in docs/friction/ for the improvement round to file.

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
