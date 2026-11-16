# Architecture review, November 2026

A read-only review (2026-11-16, at 87cc966) of the whole system after
rule-based rotations phase 2. The owner asked for "an overall analysis of
the overall architecture of the system we've built and how it could be
improved in ways that could help the development". It builds on the
[October review](review-2026-10.md), whose items are mostly done. The
evidence comes from the code (import graph, file sizes), git history
(churn, conflicted merges), one timed `npm test` run, a CPU profile of
`playRules`, timed CLI runs, and the docs. Every timing was taken on 4
cores at load 4–7, with other agents running, so treat absolute numbers
as upper bounds. The ratios hold.

## In short

The core is in good shape. The principles are followed: the engine has
no operator branches outside one new file, kit values are compiled from
the data with marked overrides, there is one scheduled list with a
documented order, and the log check runs through the engine's own replay.
The problems now sit around the core:

1. **Feedback is slow.** Every CLI call, test worker and rules worker
   spends 9–11 s rebuilding the game data. `npm test` takes about 5 min
   under load, and two files set that time.
2. **The newest layer has no button model and is the slowest code.** The
   rule driver (policy) guesses what a button casts, which caused the End
   Stance bug. It steps frame by frame through two legality checks that
   can disagree.
3. **Nothing protects the outputs the owner now uses.** Rules, gear and
   diagnosis rest on energy, SP, speed buffs and 300 s timing. The logs
   barely check those, and no test checks the rule runs' behaviour. Both
   recent rule bugs were found by the owner looking at a graph.
4. **Agents spend a lot on context and merges.** The required reading at
   session start is about 20k words. The journal, the roadmap and the
   pending-verdict snapshot are the files that conflict.

## Recommendations, prioritised

Impact is on development speed (S) and accuracy (A). Effort: S = hours,
M = a day or two, L = several days.

| # | Change | Where | Benefit | Effort | Risk |
|---|---|---|---|---|---|
| **Quick wins** | | | | | |
| 1 | Cache the compiled GameData on disk, keyed by a hash of its inputs | packages/data `loadGameData`; rulesworker | S: CLI `find` 9 s → ~1 s; `simulate` 10.6 s → ~1.5 s; each test and rules worker saves ~10 s; `gear --rules` workers start at once | S–M | A stale cache if the key misses an input: put the loader's own sources in the hash; `EFSIM_NO_CACHE`; one test compares cached with fresh |
| 2 | Split the two slow test files; move the 52 s CLI loop test to `tests/slow`; document `vitest related <file>` for targeted runs | tests/buffreplay.test.ts, tests/search-loop.test.ts, CLAUDE.md | S: `npm test` wall time ~5 → ~2.5 min under load; ends the search-loop timeouts under load | S | None |
| 3 | Rule-run invariants as tests: no press casts a skill other than the one the rule names, no press cuts the presser's own ultimate state short, waste and give-ups within a stated budget, on the three example lists | tests/policy.test.ts, engine policydiag.ts | A: catches the class of the End Stance bug without the owner's graph | S | Thresholds need tuning |
| 4 | Move operator IDs out of policy.ts: visible buffs and stacks, and their wording, become kit fields | engine policy.ts `POLICY_VISIBLE_*`, `BUFF_WORDS`; kit schema | S/A: principle 15 restored; a new operator's cue needs no engine edit | S | None |
| 5 | Generated snapshots are regenerated, never hand-merged: a `scripts/resolve-snapshots.sh`, and premerge prints the snapshot diff summary | scripts/, CLAUDE.md | S: the most-conflicted file (5 of 16 recorded conflicted merges) stops costing a manual merge | S | None |
| 6 | Journal archive again and a size rule (keep about 2 weeks); journal entries as per-branch fragments (`docs/journal.d/`) that a script concatenates on merge; a one-screen roadmap | docs/, premerge.sh | S: required reading ~20k → ~6k words; no more journal or roadmap conflicts (8 of the 16) | S | Fragments need the script |
| 7 | Worktrees work without `source`: the data directory falls back to the main checkout's; a vitest `resolve.alias` sends `@efsim/*` to the worktree's own packages; the CLI fails loudly if `@efsim/engine` resolves outside its own repository | packages/data sources.ts, vitest configs, cli main.ts | S: removes the setup step agents forget or the sandbox refuses; no silent runs of main's kits | S | Low |
| **Larger** | | | | | |
| 8 | A button model in the engine: `buttonSkill(state, operator, button)` gives what each button casts now, from the kits (stance and replacement skills), and its label is the visible cue. Presses resolve through it, not as "the first startable skill of that kind" | engine timeline/timing.ts (new), policy.ts | A: removes the wrong-skill press class; `shows` becomes redundant; the rule lists are exactly what a player presses | M | Changes rules results where the old guess differed (that is the point) |
| 9 | One legality oracle, and event-driven stepping in the rule driver | engine policy.ts, timeline/timing.ts, drivers.ts | S: rules runs 3–10× faster (estimate); `gear --rules` 18–20 min → a few minutes; the noisy cases can afford more seeds. A: one answer to "can this start now" | M–L | A missed wake-up changes results; keep an exact frame-by-frame mode and test that the two agree (the `judgeEveryFrame` pattern) |
| 10 | Assumption toggles: each unverified rule (Haste paths, finisher input, teammates' pace, SP stop) gets a named switch. `efsim rules`, `gear` and `diagnose` report whether a conclusion flips under the alternatives | engine timeline/rules.ts `TIMELINE_ASSUMPTIONS`, CLI | A: recommendations show their dependence on open in-game tests (done by hand for test 109: ±3%) | M | More runs per report |
| 11 | An accuracy scoreboard: `efsim accuracy` writes development aggregates (plain %, mismatch %, mean \|damage error\|, per operator) to a committed file at each snapshot update. Hold-outs are counted blind, as aggregates only | CLI, tests/snapshots/ | A/S: every merge shows its accuracy delta in the diff; no more hand-computed numbers in the journal | M | None |
| 12 | Split the engine into core and planning, with a lint-enforced boundary: planning imports only the timeline façade. Move `diveOf` and `nextBasics` into the timeline | packages/engine (or a new packages/planning) | S: smaller surface for agents; defines the Rust port's scope; stops planning code depending on timeline internals (40 imports today) | M | Mechanical moves; big diff |
| 13 | Log tooling as its own package. Break the `logcheck` ⇄ `enginecheck` cycle. Retire `reactioncheck`'s own enemy replay and the alternative-trying fallback once the replay covers them | packages/cli → packages/logcheck | S/A: 5.6k lines out of the CLI; one replay of the enemy | M–L | Verdict snapshots move; review each one |
| 14 | design.md split by subsystem behind a one-page index. CLAUDE.md gets a "where to look" table from task to files and docs | docs/ | S: agents read 2–3k words, not 24k | M | Links to update |
| 15 | Prune planning experiments that lost, or mark them frozen. The setup value lost on both teams; skeletons are greedy; macros cost 2.5× per state | engine search.ts, payoffs.ts, setupvalue.ts, skeleton.ts | S: less code to keep green and to read | S–M | Owner's call |

Order: 1, 2, 3, 4 and 7 first. They are cheap and make everything after
them faster to check. Then 8 with 9, since both rework the rule driver.
Then 11 and 10, because the owner's outputs need them most. 12–14 can go
whenever a quiet window allows big moves.

## What works and should be kept

- **The architectural principles** (design.md), applied in the code:
  - Operator IDs appear in engine and data code only in comments, apart
    from policy.ts.
  - The loader refuses an unmarked difference from the compiled data
    (`dataOverride`: 125 marks left).
  - Catch-alls were narrowed to the one error that means "not legal".
- **The timeline restructuring:** one scheduled list with a clock header
  per item, one in-frame order (`IN_FRAME`, `dueBefore`), and the
  `advance` memo on the context rather than in a module.
- **The log check through the engine** (enginecheck, buffreplay
  `replayCast`): the log supplies only what the engine can't know. The
  negative control, the hold-outs, and the open-problems register with
  "ruled out / still possible" are good scientific hygiene. Keep them.
- **The kit process** (analysis, then shared features, then kits),
  kit-draft and kit-trim, and `kit-census`. Kits are now mostly the
  hand-written parts.
- **Regression baselines:** the examples, kits and verdict snapshots, the
  team-order test, and exactness checks for shortcuts (`judgeEveryFrame`,
  forked against fresh runs).
- **Common random numbers** for rule runs, crits as a distribution, and
  confirming on fresh seeds. These are the right tools for noisy
  comparisons.
- **Process:** premerge.sh, CI with a timeout, the in-game test rules (by
  eye, relative, predicted), and the owner's decisions recorded with
  dates.

## 1. Structure

### Sizes

| Part | Lines | Largest files (KB) |
|---|---|---|
| engine core (model, expr, events, stats, effects, damage, reactions, status, buffs, triggers, timeline/) | 8,550 | model 47, timeline/landing 30 |
| engine planning (search, bound, payoffs, macros, setupvalue, skeleton, loop, distribution) | 3,760 | search 75, payoffs 67 |
| engine policy (policy, policydiag, policysearch) | 1,380 | policy 42 |
| data (tables, SkillData and BuffData, skillCompile, kits loader, kitMatch, zmdlogs) | 6,070 | kits.ts 84, skillCompile 74 |
| cli: log tooling (logcheck, enginecheck, buffreplay, logcasts, logeffects, reactioncheck, recordedburst, bufftiming, hitvalues) | 5,640 | buffreplay 99, logcheck 94, bufftiming 42, enginecheck 41 |
| cli: commands (main, simulate, gear, gearrules, rules, diagnose, rulespool, kitdraft, …) | 3,970 | main 600 lines |
| kits (JSON) | 1.4 MB, 33 operators + 107 equipment | zhuangfy 105 KB, purrchena 81, typhoeus 68 |
| tests | 18,150 (2,112 tests, 83 files) | timeline.test 2,140 lines |

### Dependency picture

```
data/ submodules ─► @efsim/data: tables/ · skillData · buffData · skillGraph   (three SkillData walkers)
                                 skillCompile ─► kitMatch ─► kits.ts (fills kits from the compiler, dataOverride)
                                 zmdlogs (log import)
                       │ GameData (tables + normalised kits)
                       ▼
@efsim/engine
  core:     model ⇄ expr ⇄ events        (kit DSL types, predicates, events: a small cycle)
            stats · effects · damage · reactions · status · buffs · triggers
            timeline/  state · schedule · clock · resources · timing · situation
                       actions · landing · casting · advance · drivers · teammates
                       (mutually cyclic by design: casting runs triggers, triggers cast)
            timeline.ts  façade
  planning: search ─► bound ─► payoffs;  search ─► macros, setupvalue ─► payoffs
            skeleton ─► search;  loop ─► search;  distribution ─► search
  policy:   policy ─► search (diveOf, nextBasics) · policydiag ─► policy · policysearch ─► policy
            planning and policy import timeline/* internals 40 times, not just the façade
                       │
                       ▼
@efsim/cli
  commands: main · simulate · gear · gearrules ─► diagnose ─► rulespool ◄─ rulesworker (loads data again)
  log tool: logcheck ⇄ enginecheck (cycle) ─► buffreplay ─► logcasts
            logeffects · reactioncheck (its own enemy replay) · recordedburst · hitvalues
            bufftiming ─► logcheck, enginecheck, buffreplay, logeffects
                       ▲
tests/: 56 of the files import @efsim/cli (the log tooling is used as a library)
```

### Findings

- **No layering violations across packages.** The engine imports nothing
  outside itself, as lint enforces. The cycles inside timeline/ are
  documented and safe.
- **`logcheck` ⇄ `enginecheck` is a real cycle** in the CLI. `bufftiming`
  depends on four log modules. The log tooling is a subsystem as large as
  the engine core, living in the "display" layer.
- **The planning code reaches into timeline internals.**
  - policy.ts imports `skillAvailable`, `needsWindow`, `windowOpen`
    (timing), `spAt`, `isStaggered` (resources) and `kitSkill`
    (context).
  - payoffs.ts imports actions and situation.
  - policy depends on search.ts for `diveOf` and `nextBasics`, which are
    game rules (what the attack input casts) and belong in the timeline.
- **God modules.**
  - search.ts (75 KB) and payoffs.ts (67 KB) hold several algorithms
    each.
  - buffreplay.ts (99 KB) and logcheck.ts (94 KB) are where log work
    concentrates: 18 and 10 of the commits since 2026-10-26, and
    buffreplay.test.ts 21.
  - model.ts (47 KB) is all the kit DSL's types in one file; it changes
    with every new kit field.
- **Duplicated logic still standing:**
  - Three ways to ask "can this start now": `startsNow`, `earliestStart`
    and `skillAvailable`. The rule driver needs two of them to agree,
    because once they didn't (Typhoeus's battle skill 48 frames early,
    journal 2026-11-16).
  - Two enemy replays: the timeline's, and `reactioncheck`'s (open since
    round one).
  - Three SkillData walkers (skillData.ts `walk`, skillGraph.ts `walk`,
    skillCompile.ts). All three run at load and show in the profile.
  - The teammates' chain heads (teammates.ts:30) restate part of
    `nextBasics`.
- **Logic in the wrong place, engine side:**
  - `POLICY_VISIBLE_STACKS`, `POLICY_VISIBLE_BUFFS` and `BUFF_WORDS` in
    policy.ts list Typhoeus, Laevatain, Liino and Si by ID and buff name.
    This is the only operator-specific engine code. Every new operator
    with a visible stance needs an engine edit.
  - The `shows` filter compares kit display labels as strings.
- **Logic in the wrong place, kit side:**
  - Kits carry the game's trigger logic as data, as intended. A few
    hand-written frames (trigger `delay` such as Si's 62) restate
    SkillData frames the compiler could fill.
  - Prose dominates the kits: in Si's kit, notes and sources are 14k of
    22k characters. That is valuable provenance, but agents pay for it
    on every read. A compact view without notes (`efsim kit-show`) would
    help.

## 2. Correctness infrastructure

### What protects accuracy today

| Layer | What it catches | Blind spot |
|---|---|---|
| Unit and kit tests (2,112) | formula zones, kit behaviour as written | the kit author's reading of the data, if it is wrong |
| Compiled kit values + `dataOverride` | a hand-written frame, factor or energy value that differs from the data | what the compiler can't read: branches, combo conditions, about 125 marks |
| Examples snapshot (39 scenarios) | any change to a result | right or wrong: it only pins |
| Verified log fixtures (6) + ratchet | fewer plain matches, more fallbacks | only 6 fights |
| Pending verdict snapshot (67 logs, hold-outs among them) | any change | pinned exactly, so improvements and regressions look the same. Updating it is routine (62 commits since 2026-10-26) |
| Negative control, hold-outs | overfitting the checker | hold-outs are only as informative as someone computing their aggregates |
| In-game tests (owner) | what logs can't show | slow; about 100 open, ranked |
| premerge.sh, CI | unmerged red tests, missing journal entry | not semantic |

### What slips through

The recent errors share a pattern. None was a damage-formula error, and
none was caught by a test:

- **Liino's End Stance press:** the rule driver resolved a press to "the
  first startable skill of that kind". Found by the owner on the damage
  graph.
- **Si's Haste:** a data reading the owner doubted. The logs can't see
  it, because ZMDLogs keeps no speed buffs and fixtures keep only buffs
  with damage effects.
- **Ink Melt's surge:** not a bug, but also found on a graph.
- **Typhoeus's missed shots:** a gap in the log replay. Found by
  diagnosis of open problems.

The kinds of error that get through:

1. **Behaviour in long fights.** The logs are 30–150 s. Rules, gear and
   diagnosis judge 300 s fights through the energy and SP economy, which
   the logs don't record, and through speed buffs and teammates' own
   attacks (test 101).
2. **Policy behaviour.** The rule driver's choices are checked only for
   replay consistency (`simulate` reproduces the run). Nothing checks
   that they are what a player would do with that list.
3. **Assumptions that flip a recommendation.** The Initial Stroke advice
   is +3% under one reading and −3% under the other. That was found
   because the owner asked. Nothing re-runs a recommendation under each
   open assumption.
4. **Accuracy drift between rounds.** Development and hold-out aggregates
   are computed in scratch scripts and quoted in the journal (for
   example 22.1 → 21.7% mean |damage error|). A merge doesn't show its
   accuracy delta, and snapshot updates hide it.

Context for the recommendations' stakes: the development logs still
match only about 35% of hits plainly, with a mean |damage error| of about
22% per fight (accuracy plan, 2026-11-13). The rules and gear
comparisons decide differences of 1–8%. Such a comparison is only as good
as the mechanics that differ between the candidates. That is why the
assumption toggles (#10) and the scoreboard (#11) are high on the list.

### Feedback loop

- `npm test`: 308 s wall time, under load. The per-file times add up to
  460 s, and two files make 45% of that: buffreplay.test.ts (105 s;
  slowest test 34 s) and search-loop.test.ts (103 s; one CLI test takes
  52 s against a 60 s timeout, the one that timed out under load 8 on
  2026-11-15). Each of the 4 workers also builds the game data
  (~10–15 s).
- `npm run test:logs` adds the pending fixtures in two shards (about
  3 min) and the negative control (about 1 min). The full `npm run check`
  takes 8–10 min under load.
- Nothing targeted is documented. `vitest related <changed files>` works
  with the import graph and would give a kit or policy change a
  sub-minute check.

## 3. Developer and agent workflow

- **Required reading:** the journal (1,803 lines, 17.9k words; the last
  archive was at 2026-10-21) plus the roadmap, CLAUDE.md and README come
  to about 20k words before any work starts. The design principles add
  more, and design.md is 24k words (10k of it on the search). The docs
  hold 101 markdown files and about 480k words. The roadmap's "Next
  steps" items run 15–30 lines each, so "what's next" is itself hard to
  read.
- **Churn and conflicts:** since 2026-10-26 the most-changed files are:
  journal 65 commits, pending verdict snapshot 62, open-problems 56,
  accuracy-plan 50, roadmap 45, in-game-tests 41, design 38. Of the 16
  merges that record conflicts, the conflicted files were the pending
  snapshot 5 times, the journal 5, skillCompile.test's lists 4 and the
  roadmap 3. Every parallel branch appends to the same
  top-of-file spots.
- **Worktree setup:** `source scripts/setup-worktree.sh` is needed, or
  tests and the CLI silently run the main checkout's kits. Premerge
  catches it at the end, not at the start. Some sandboxes refuse
  `source`.
- **Slow and noisy measurement:**
  - A rule list's sustained DPS moves 2–5% (sd) between delay seeds, and
    the beam search is chaotic: a small gear change sends it to other
    rotations.
  - Agents therefore need many runs to say anything, and gear --rules
    takes 18–20 min a team.
  - The 9–11 s data load on every CLI call makes exploration expensive:
    `efsim find laevatain` took 9.1 s, `simulate` 10.6 s.
- **Big files to read:** buffreplay.ts, logcheck.ts, search.ts, kits.ts
  and the 105 KB Zhuang Fangyi kit. Docs cite line numbers that go stale.
- **Diagnosis by graph works:** the owner's damage-graph artifact found
  two issues in a day. A standard per-run timeline view, made by the CLI
  and published as an artifact, would make that systematic.

## 4. Performance

A CPU profile (`node --cpu-prof`) of loading the data once, then 3 ×
`playRules` on Ink Melt over 300 s: 23 s total at load 7.

| Where | Share | Notes |
|---|---|---|
| `loadGameData` | 42% (9.8 s) | kits 5.2 s, of which `compileSkill` re-walks SkillData for every operator 3.3 s; `parseJsonExact` 3.7 s, of which the int64 regex scan 0.8 s; `readFileSync` 1.6 s |
| `playRules` (3 runs) | 43% (2.6–4.7 s a run) | `basicAttack` 25%, `canPress` 19%, `startsNow` 18%, `earliestStart` 14%, `skillAvailable` → `gatesFrom` → `advance` 25%: most of a run is spent asking whether something can start, by advancing copies of the state |
| garbage collection | 12% | immutable state copies per advance |
| damage (`landHit`, `computeHit`, `panelModifiers`, `situationAt`) | ~15% | the actual simulation |

Opportunities, largest first:

1. **Cache the data** (#1). The same 10 s is paid by every CLI call, by
   each test worker, and by each `rulesworker` thread in `gear --rules`
   and `diagnose`. A v8-serialised or JSON bundle, keyed by the submodule
   commits plus hashes of tables.json, the kits and packages/data/src,
   loads in well under a second.
2. **Event-driven rule stepping** (#9). `playRules` loops over every
   frame (18,000 in 300 s). At each frame it evaluates every cue and
   probes presses. Between events nothing a cue reads can change. Events
   are: the next scheduled item, a cooldown or `readyAt`, an SP or energy
   threshold, a cue delay running out, the basic attack's cached earliest
   start. Jumping to the next event, with the probes answered once per
   event, should cut most of the 85% of a run spent on probes.
3. **A cheaper "can start now".** `startsNow` already short-cuts costs
   and cooldowns. `earliestStart`'s binary search over `advance` of
   copies could stop early when nothing on the operator's own timeline
   can end the action sooner (the common case).
4. **Workers already exist** (rulespool). Once the data load is cached
   they scale. The search could use them per beam width, since
   `efsim search` runs widths w/2, w and 2w independently.
5. **Tests:** after #1 and #2, the suite's wall time is set by its
   slowest file. Keep every test file under about 30 s.

## 5. Extensibility

- **A new operator, weapon or gear set:**
  - The kit process, kit-draft and the compiler make this mostly data.
    The friction is the 129 KB kit schema and model.ts, which every new
    mechanism family touches.
  - Visible cues need an engine edit (policy.ts) until #4.
  - Kit tests are per operator (tests/kit-*.test.ts) and hand-written. A
    shared table-driven harness ("this cast, these hits at these
    frames") would shorten them.
- **A new cue or rule feature:**
  - Touches the schema (rules.schema.json), the `PolicyCue` union,
    `cueHolds`, `cueCost`, `describeCue`, the rule search's moves
    (policysearch.ts) and the diagnosis.
  - Six places. A cue registry (one record per cue: type, rank, holds,
    words, search moves) would make it one.
  - The roadmap wants "gate a press on the button's state" and
    "cross-operator alignment" moves. Both are easier on top of the
    button model (#8).
- **A new output (report, artifact, gear view):**
  - The CLI formats text directly from engine results. There is no
    `Result` schema yet (roadmap item 6).
  - A JSON result per command (run, rules, diagnose, gear) would let the
    damage-graph artifact, the team pages' tables and future web views
    share one producer, instead of each agent's scratch script.
- **A new kind of fight (multi-target, other enemies):** 20
  multi-target logs wait in fixtures/multi-target. The engine and the
  log check are single-target, and that is the largest extension still
  ahead. Worth a design note before anyone starts.

## 6. Recommendation details

**1. GameData cache.**
- `loadGameData()` checks
  `.cache/gamedata-<hash>.bin` (git-ignored) and otherwise builds and
  writes it.
- The hash covers the data submodules' commits (or the fetched tables'
  mtimes and sizes), `packages/data/tables.json`, every kit file and
  every file under `packages/data/src`.
- Tests keep freezing the loaded object. `rulesworker` reads the same
  file.
- A test builds fresh and compares it with the cache, so the cache can't
  hide a loader change.
- This doesn't touch the principle that the DataBundle is generated and
  never committed: the cache is not committed.

**2. Test balance.**
- Split buffreplay.test.ts by subject: Typhoeus, Liino, Si, equipment,
  generic.
- Move the `efsim search --loop` CLI test (52 s) to tests/slow, keeping
  a faster engine-level loop test in the unit suite.
- Add `npm run test:related` (`vitest related --run $(git diff --name-only main)`)
  and mention it in CLAUDE.md for iteration. `npm run check` stays the
  gate.

**3. Rule invariants.** policydiag already observes every frame. Add
counters for:
- presses whose cast skill differs from the rule's intended button
  label;
- presses that end the presser's own active ultimate state or stance;
- give-ups.

tests/policy.test.ts runs the three example lists for 60–120 s and
expects zero of the first two, unless the list allows them.

**4. Visible state as kit data.**
- A kit buff or stack gets `visible: { words: ["is in Vocalist Stance",
  "isn't in Vocalist Stance"] }`.
- The rule loader accepts any visible state.
- policy.ts loses its three operator tables.

**5. Snapshot merges.**
- On a conflict in `tests/snapshots/*.json`, take either side and run
  `npm run snapshots:update`. A script does it and shows the diff.
- premerge.sh prints the verdict and example deltas, and #11's
  aggregates once that exists, so the reviewer sees the effect.

**6. Journal and roadmap.**
- Archive everything older than about two weeks.
- Each branch writes `docs/journal.d/YYYY-MM-DD-slug.md`. premerge (or a
  post-merge script) prepends the fragments to the journal in date
  order.
- The roadmap's "Next steps" become a short list of one line each, with
  links to the team pages, the accuracy plan and the open problems.

**7. Worktrees without `source`.**
- `dataDir()` falls back to the git common directory's `data/` when the
  local one has no tables.
- vitest configs alias `@efsim/(cli|data|engine)` to
  `./packages/$1/src/index.ts`.
- main.ts checks that `import.meta.resolve("@efsim/engine")` is under
  its own repository root, and otherwise tells the agent to run the
  setup.

**8. Button model.**
- The engine gains the notion of the three skill buttons per operator
  and what each casts at a frame. The source is the kit: which skill a
  buff makes the button cast (Liino's stance → End Stance, Si's Artful
  Intent → Initial Stroke, Inksoul → Final Stroke, Laevatain's Twilight).
  Where the data's input mapping exists, it comes from there.
- A press is that skill or nothing. The button's label is a rank-3 cue.
- The log importer can check its cast-to-button reading against it.

**9. Rule driver: one oracle, event stepping.**
- Make `earliestStart` from the state after the last press the only
  legality check (`startsNow` as its proven shortcut, with the same
  answer, tested).
- Replace the frame loop with "advance to the next wake-up".
- Keep the frame-by-frame mode as `exact: true` and test that both give
  the same rotation on the examples.

**10. Assumption toggles.**
- Collect the open readings that move results (`TIMELINE_ASSUMPTIONS`
  plus kit branches tied to in-game tests 101, 102, 108, 109) as named
  switches in the scenario options.
- `efsim rules`, `diagnose` and `gear` take `--assumptions all` and add
  a line per conclusion: "holds under all readings" or "flips under test
  109's alternative".

**11. Accuracy scoreboard.**
- `npm run snapshots:update` also writes `tests/snapshots/accuracy.json`:
  the development aggregates, per operator and overall, and the hold-out
  aggregates (computed, never printed per log).
- The journal quotes it instead of scratch numbers. A drop is visible in
  review.

**12–14. Package boundaries and docs.**
- Planning code imports `timeline.ts` only, enforced like the engine's
  no-dependency rule.
- The log tooling moves to its own package with the cycle broken
  (`enginecheck` gets the shared types, `logcheck` the orchestration).
- design.md becomes an index plus one file per subsystem: data and kits,
  timeline, damage, search, rules, log check.

**15. Prune.** The journal records the setup value as worse on both
teams, skeletons as greedy, and macros as costlier per state while losing
at equal time from zero energy. If the owner agrees, delete what lost, or
move it behind one experimental flag with a dated note. The rules now
carry the human-facing output.
