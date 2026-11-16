# Gear on rules, phase 2 (2026-11-16)

Task: make gear selection part of rule-based optimization: common random
numbers for the reaction delays, a diagnosis of a rules run with marginal
values per gear stat (`efsim diagnose`), gear scored by playing a rule
list (`efsim gear --rules`), runs on three teams, docs and tests. Branch
`worktree-agent-ab9a18fc1fa5d1380`.

## 1. The sandbox refuses the worktree setup and most compound commands

- **What happened:** the brief says to run `source
  scripts/setup-worktree.sh` first. The worktree-isolation guard refused
  it ("runs a string through source, which can't be verified to stay
  inside the worktree"). I copied the script's body by hand (`mkdir -p
  node_modules/@efsim && ln -sfn …` for cli, data, engine) and then had to
  put `EFSIM_DATA_DIR=/home/user/Endfield-battle-simulator/data` in front
  of every test, CLI and scratch command. Forgetting it once gave
  `Error: rmxlinux data not found at …/worktrees/…/data/rmxlinux-EndfieldData`.
  Many other commands were refused too: `cd … && git log`, a `for` loop
  with `git` in it, and any Bash heredoc that wrote a Python edit script
  (`cat > x.py <<'EOF' … EOF && python3 x.py`): "too complex to verify
  that it stays inside the worktree". One background run script was never
  created because its heredoc was refused, and the background job then
  failed with "No such file or directory". In all, about 8 refused or
  failed attempts. The workaround: write each edit script with the Write
  tool into the scratchpad, then run it as a plain command.
- **Cause:** the setup has to be sourced because it exports an
  environment variable, and the data location exists only as that
  variable. The guard can't parse sourced scripts, heredocs or compound
  commands that mention `git`.
- **Suggestion:**
  - In `packages/data/src/sources.ts` (`dataDir()`), when `data/` in the
    repo root is empty or missing, fall back to the main checkout's
    `data/`, found from `git rev-parse --git-common-dir` (or from the
    `.git` file's `gitdir:` line, so no git call is needed).
  - Make `scripts/setup-worktree.sh` a plain executable that only creates
    the three symlinks, not a sourced script.
  - Say in CLAUDE.md that scratch edits should be written with the Write
    tool, not shell heredocs, in isolated worktrees.
- **Why it helps:** worktree agents work without remembering an
  environment variable, and the first command of every session stops
  being refused. Risk: a stale main checkout's data is used silently.
  Printing which data directory was used, once per run, covers that.

## 2. Stats that move the timeline are noisy even on common seeds, and every check takes minutes

- **What happened:** with common random numbers, damage-only steps
  (Arts Intensity, element DMG, …) came out to ±0.1% at 4 seeds.
  Ultimate Gain Efficiency, and attributes that flip Arcane's mode, stayed
  at ±1–2% a line at 4 seeds and ±0.6–1.3% at 16, because they move when
  ultimates come and the runs' events no longer line up.
  - My first findings called Akekuri's efficiency "worth ~0"; with more
    seeds it was +2.9% ± 0.9, her best line.
  - Ink Melt's ascent took a change at +7.3% ± 2.4. On fresh seeds it was
    +2.1% ± 2.5 on 8 and +3.9% ± 1.0 on 24, because the ascent picks the
    best of many noisy candidates.
  - Two owner's-team ascents took different first changes (Akekuri's,
    then Si's).
  - I had to add more seeds for noisy marginal values and noisy gains,
    plus a fresh-seed check, and rerun all three teams: 18–24 min a team
    (1,000–1,300 playRules runs of 300 s on 3 workers). The first round of
    runs was thrown away.
- **Cause:** the fight is chaotic for the rule driver: a few frames' shift
  moves where Stagger windows and ultimates fall. Each 300 s `playRules`
  takes 1.5–3 s, so every question about a timing stat costs dozens of
  runs.
- **Suggestion:**
  - Document the noise in design.md "Rule-based rotations" as a table
    (done in part): about 0.1% for damage-only stats, 1–2% a line for
    timing stats at 4 seeds.
  - Make "more seeds when the standard error is over 0.25%" and "confirm
    on fresh seeds" defaults of any comparison tool. `paired`,
    `beyondNoise` and `MARGINAL_NOISY` in `packages/cli/src/diagnose.ts`
    already do this.
  - Longer term, estimate a timing stat's worth analytically from the
    diagnosis: energy held or wasted × the ultimate's value per cast
    (damage of the casts plus the buffs they put on the main damage
    dealer).
  - Profile `playRules` (packages/engine/src/policy.ts): cue reading and
    `startsNow` / `earliestStart` at every frame are most of its cost.
- **Why it helps:** fewer wasted rounds, and no "gains" that are selection
  noise. The analytic estimate would make gear search on timing stats
  cheap. Risk: it is a model of a model, so it should be checked against
  play.

## 3. Worker threads load the engine at spawn, so code can't be edited while a long run goes on

- **What happened:** `runRulesJobs` (packages/cli/src/rulespool.ts)
  starts new workers for every call, and each one imports the engine
  then. During the 70-minute three-team run I wanted to fix
  `diagnose.ts` / `gearrules.ts` (main process only: safe) and
  `policydiag.ts` (engine: workers spawned later would load the edited
  file mid-run). I kept engine edits out until the run finished, and
  worked around one change in the CLI layer instead. The first round's
  results came from code that changed later, so the owner's team was run
  twice (g1, then g2).
- **Cause:** a pool per call, and no snapshot of the code used for a run.
- **Suggestion:**
  - Create one worker pool per CLI command (`runRulesJobs` taking a pool
    object), started once.
  - Print the git commit and a dirty-tree flag at the head of `efsim
    diagnose` / `efsim gear --rules` output.
- **Why it helps:** you can keep working during long runs, and the
  results say which code made them. Cost: a little lifecycle code (close
  the pool on exit).

## 4. Seeded and example numbers are copied by hand into many files

- **What happened:**
  - Changing the delay random numbers changed every seeded result. I
    updated them by hand in docs/design.md (results table), three team
    pages' "Rules" tables (4–5 rows each, full energy and from zero) and
    three `examples/*.rules.json` descriptions. That meant six `efsim
    rules --seeds 10` runs (51–77 s each) and copying about 40 numbers.
  - Changing Perlica's example gear changed 5,757,797 / 4,989,348. Those
    appear in both scenario descriptions, tests/snapshots/examples.json,
    the team page (four places) and the journal. The Typhoeus "Rules"
    table had to be run again too.
- **Cause:** results live in prose and tables in several files. Nothing
  generates them or checks them against the code.
- **Suggestion:**
  - Add `efsim rules --markdown-row` (or a `scripts/rules-tables.ts`) that
    prints the team-page table rows (sustained DPS and sd, bot / 0.6 s,
    first 60 s against the timeline) for both energy starts.
  - Add a test in tests/policy.test.ts that runs each example list at 2
    seeds over 60 s and compares it with a small snapshot, so drift is
    caught when the numbers change.
- **Why it helps:** fewer copy errors, and docs that don't go stale
  silently when the RNG or a kit changes. Cost: the snapshot needs
  updating with intended changes, as tests/snapshots/examples.json does
  now.

## 5. The gear tables' stat lines need decoding, and there's no readable label

- **What happened:** to size the marginal values I listed every T4 gear
  line. Lines came out as `Level(0) slot 5 target 1`, `Level(0) slot 6
  target 2` and `Wisd(41)`. Reading `resolveTarget` in
  packages/engine/src/stats.ts showed that attribute 0 with target 1 / 2
  means the operator's main / secondary attribute, and slot 6 is a
  percent. `attrName` returns internal names (Wisd, Agi). I wrote my own
  label map (`ATTR_WORDS` and `probeLabel` in
  packages/cli/src/diagnose.ts), and a second inline map for
  Intellect / Will in gearrules.ts. gear.ts and edge.ts have their own
  versions.
- **Cause:** there's no shared "stat line as the game shows it" function
  in the engine.
- **Suggestion:** add `statLabel(data, attr, slot, target, value)` to
  packages/engine/src/attributes.ts. It should give the in-game names
  (Intellect, Ultimate Gain Efficiency, Arts Intensity, "main attribute"),
  with percent formatting by slot. Use it in gear.ts, edge.ts,
  diagnose.ts and gearrules.ts.
- **Why it helps:** one correct mapping instead of four, and readable
  gear output. Cost: small.

## 6. The scenario's timeline is tied to its gear, so commands crash on other gear

- **What happened:** `efsim rules` on the owner's scenario with the new
  gear failed at once: `frame 1476: chr_0036_jsspsi_ultimate_skill needs
  80 ultimate energy, 71.0`. It simulates the scenario's own rotation as a
  reference, and Si without her efficiency gloves can't play that
  timeline. I fixed it (rules.ts now reports that no reference can be
  played). `efsim gear --rules --out` still writes the old timeline
  rotation next to the new gear, so the scenario it writes doesn't play
  under `simulate` either.
- **Cause:** a scenario holds both a team build and a frame-exact
  rotation made for that build, and tools assume they match.
- **Suggestion:** for gear written by `gear --rules`, write `rotation: []`
  plus a `rotationNote` (the schema allows a description). Or have
  `readScenario` accept a flag that skips the rotation.
- **Why it helps:** files written by the rules tools don't break other
  commands. Cost: a schema look at whether an empty rotation is allowed
  everywhere.

## 7. Main moved twice during the task; the journal and roadmap tops conflict every time

- **What happened:** main changed the owner's rule list mid-task (rule 9,
  new rule 10). I merged it and reran the owner's-team runs. A later main
  commit (Si's Haste notes) conflicted in docs/journal.md and
  docs/roadmap.md: both branches had added a top entry or bullet.
  Resolving it and rerunning premerge (about 15 min) came last.
- **Cause:** every session prepends to the same lines of two shared
  files.
- **Suggestion:** one journal file per session under
  `docs/journal/2026-11-16-<slug>.md`, with docs/journal.md as an index
  sorted by date (generated, or appended only at the end). The roadmap
  gets one bullet per area, each edited in place, with no new top
  bullets.
- **Why it helps:** parallel agents' merges stop conflicting on prose.
  Cost: one more file per session.

## What worked well

- The engine's moment arithmetic (packages/engine/src/moments.ts:
  `hitsMoments`, `combineBattles`, `critSpread` on each hit) made crits
  as a distribution a few lines of code.
- `playRules` being a plain frame loop over `advance` / `apply` made a
  read-only observer (the diagnosis) easy to add without touching the
  damage model.
- The search's state-key rules (`STATE_KEY` in packages/engine/src/search.ts)
  forced every new state field to be declared as a statistic. That
  stopped the energy counters from leaking into search keys.
- Synthetic gear pieces for probes needed no engine change: a cloned
  `GameData` with extra `gear` entries goes through the same stat code.
- `gearCandidates` and `describeGear` from gear.ts could be reused as
  they were; tests/policy.test.ts gave a ready pattern for small
  owner's-team fights.
- `scripts/premerge.sh` caught nothing wrong but gave confidence in one
  command.

## Outcome (round 1)

1. Worktree setup and sandbox: **done** (setup without `source` landed before this round; CLAUDE.md now lists the command shapes that work, `scratch/` and the Write/Edit rule).
2. Noise of timing stats, more seeds, fresh-seed confirmation, analytic estimate, profiling `playRules`: **assigned to phase 2** (rule driver and rule noise).
3. Worker pool per command: **assigned to phase 2.** Printing the code at the head of long runs: helper **done** (packages/cli/src/provenance.ts `codeProvenance()`), the call sites in diagnose / gear --rules are phase 2's.
4. Seeded numbers copied by hand (`rules --markdown-row`, a snapshot of the example rule lists): **assigned to phase 2** (rules.ts, tests/policy*.test.ts).
5. Readable stat lines: **done.** `statLabel` / `attrLabel` in packages/engine/src/labels.ts, used by gear.ts and edge.ts; diagnose.ts and gearrules.ts are phase 2's to switch (tests/labels.test.ts checks statLabel gives the diagnosis' probe labels exactly).
6. `gear --rules --out` writes a rotation the new gear can't play: **assigned to phase 2** (rule tooling).
7. Journal and roadmap conflicts: **done** (journal entries as files before this round; `npm run merge -- <branch>`, scripts/merge.ts, rebuilds the built journal files on a merge).
