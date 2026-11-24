# CLAUDE.md

Project overview and goals: [README.md](README.md).

## Branches

Until the first genuinely useful version exists:

- `main` is the working branch. Merge finished work into `main` and push it
  without asking or waiting for approval.
- Other branches are only for running several sub-agents in parallel on
  different parts of the system; merge them back into `main` when done.

After that milestone, a `dev` branch takes over the role `main` has now.

## Journal and roadmap

- At the start of a session read [docs/journal.md](docs/journal.md) (the
  last 10 entries; all of them: [docs/journal/](docs/journal/README.md)) and
  [docs/roadmap.md](docs/roadmap.md) (one screen; details in
  [docs/roadmap-details.md](docs/roadmap-details.md)).
- Keep [docs/open-problems.md](docs/open-problems.md) current: for each
  unexplained accuracy problem, what is ruled out and what is still possible.
  Diagnosis briefs ask for both.
- Before a session ends (or after a significant milestone), add a short
  journal entry: goal, what was done, decisions and why, dead ends or
  problems. Each entry is its own file: `npm run journal:new -- "Title"`
  writes `docs/journal/YYYY-MM-DD-NN-slug.md` (first line
  `## YYYY-MM-DD: Title`); write it, then `npm run journal` rebuilds
  docs/journal.md and the index (`npm run check` fails if they're stale).
  Never edit docs/journal.md by hand; on a merge conflict in it or the
  index, run `npm run journal`. An entry written the old way (at the top of
  docs/journal.md): `npm run journal:adopt` (or `-- --from MERGE_HEAD`).
  Cite an entry by its file (`docs/journal/2026-11-16-03-….md`), never by a
  line of docs/journal.md.
- Update the roadmap's next steps: a line or two each, the rest in
  roadmap-details.md.

## Code layout

- `packages/engine`: `src/core.ts` (`@efsim/engine/core`: the kit model,
  damage, statuses and the timeline) and `src/planning/` (search,
  payoffs, the rule driver), which imports the core only through
  `../core.ts` (lint). `@efsim/engine` exports both.
- `packages/data`: tables, the SkillData / BuffData compiler, kits; it
  imports only `@efsim/engine/core`.
- `packages/logs` (`@efsim/logs`): log import and the log check.
- `packages/cli`: one module per command in `src/commands/<name>.ts`
  (usage lines, options, run), listed in `src/commands/index.ts`.
- `docs/design.md`: the principles and an index; each subsystem is in
  `docs/design/<topic>.md`. `node scripts/check-links.ts` (a test runs it)
  checks that relative doc links resolve.

## Correctness

The tool is only useful if its numbers are right. Keep tests up to date and
passing with every change. Follow the architectural principles in
[docs/design.md](docs/design.md#architectural-principles).

Tests: `npm test` is the default suite; `npm run test:logs` (`tests/slow/`:
pending logs, negative control, single tests of tens of seconds) and
`npm run check` (both, plus types and lint) run before a merge. While
working, run only what a change touches: `npx vitest run tests/<file>.test.ts`
(one file; `-t "<name>"` for one test) or `npx vitest related --run
<changed source files>` (every test file that imports them), and `npm run
lint:changed` (ESLint on the files changed since `main`, seconds). After a
change to the engine's timing rules (packages/engine/src/timeline/, kit
timing): `npm run smoke` (under 2 min: kit tests, loop searches, the
owner's rules check, the examples) before premerge; an example that stops
playing: `npm run -s efsim -- repair examples/<file> --write`. A kit or
engine change's team numbers: `node scripts/team-ab.ts --base <ref>` (an
identity check first: the 32-seed runs only when a team's own fight
changed; it prints the table). A
background test run: add `--reporter=default
--reporter=./scripts/vitest-progress.ts` (a line per finished file). A test file
that takes over ~40 s gets split, and a single test of tens of seconds goes
to `tests/slow/`. Shared test builders live in `tests/helpers/` (synthetic
kits and logs, buff history); after a split, `npm run prune-unused --
<files>` drops the imports and helpers each half no longer uses. Vitest shows a passing file's `console.*` output only
with `--silent=false`: a line every run must show goes through
`process.stdout.write`.

Snapshots (`tests/snapshots/*.json`) and the accuracy scoreboard
([docs/accuracy.md](docs/accuracy.md)) are generated: `npm run
snapshots:update` regenerates them all from the current code (it prints
the scoreboard's change and which logs got better or worse). On a merge
conflict in any of them, take either side and run it; never merge them by
hand. Quote the scoreboard's numbers, not scratch sums, in the journal.
To try an idea, measure instead: `npm run measure [-- --with <op>]`
(about a minute for every log, writes only `scratch/measure/`; `--at
<ref>` / `--base <ref>` for other commits' code, `--assume <id>=<r>` for
an open reading, `--variant <id>=<r>` (repeatable) for several in one run
instead of chained measures, `--patch <diff>` for a change that is none:
[docs/design/tests.md](docs/design/tests.md#measuring-a-change); a change
measured and dropped keeps its diff in [docs/tried/](docs/tried/README.md)),
and run `snapshots:update` once for the final commit (`-- --costs` only
to rebalance the pending shards). Diagnosis views: `efsim zmdlogs
groups|differences|casts|replay|stagger|holds --why`; one command at two
commits' code, the lines that differ: `node scripts/cli-ab.ts <ref> --
<efsim args>` (`--holds <fixture>`: which bounds a change moved). A new
test that should fail before the change: `node scripts/verify-at.ts <base>
--test <file> -t <name>`. A build offset: `efsim zmdlogs offsets --all`
finds them, `efsim zmdlogs fit-build <fixture> --operator <op>` fits one,
kept as the fixture's `buildOverrides` (first steps in
[docs/open-problems.md](docs/open-problems.md)). After a fixture move, `node scripts/snapshot-keys.ts <file> --rename
<regex> <to>` renames snapshot keys (counts only, no values shown).

The owner plays daily and may run simple in-game tests. Keep
[docs/in-game-tests.md](docs/in-game-tests.md) current and tell the owner
when a new test becomes ready. Logs first: never ask the owner for
anything the logs can decide (timings, durations, paces, damage, listed
buffs, Stagger bars); only what no log records (SP, energy, cooldowns,
inputs, icons, the screen), after trying the logs.

## Operator kits

Kits (operators, their weapons and gear sets) are implemented in batches,
in phases: analysis of every operator in the batch first (gap reports, no
implementation), then shared features per family, then re-analysis, until
nothing is missing; only then the kits. See
[docs/kit-process.md](docs/kit-process.md). Before implementing anything for
one operator only, check [docs/kit-unique.md](docs/kit-unique.md): if
another operator has it too, it's shared.

After a batch's kits are in, repeat the pattern review in
[docs/kit-abstractions.md](docs/kit-abstractions.md#repeating-the-review)
(`efsim kit-census`).

## Worktrees and sub-agents

In a git worktree (sub-agents' `.claude/worktrees/…`), run
`node scripts/setup-worktree.ts` once (no `source`, no `EFSIM_DATA_DIR`): it
links the worktree's own packages, which the CLI refuses to run without.
Vitest does it itself; the game data is found in the main checkout. Before
merging a branch into `main`, run `node scripts/premerge.ts`
(`scripts/premerge.sh` is the same: one exec of it): about 15–20 min
(more under load and the lock's queue), so run it in the background with a
limit of 2 h. It
runs every step (but skips the test suites when typecheck or lint
fails), re-runs files that only timed out, waits for other worktrees'
suites (a shared lock) and ends with a pass/fail table. A game-data
rebuild (~10 s) prints why on stderr (which inputs changed). To verify a
commit while you go on editing: `node scripts/verify-at.ts [<ref>]`.

The CLI in a worktree: `npm run -s efsim -- <args>` (`efsim` isn't on the
PATH there). Command shapes the worktree sandbox accepts (others are refused as "too
complex to verify"):

- One plain command per Bash call, run from the worktree, absolute paths.
  No `source`, no `cd … && git …` chains, no loops or pipes around `git`,
  no `git -C`. `git show <ref>:<path> > scratch/x`, then process the file.
  A sequence mixing `git` with other commands goes into `scratch/x.ts`
  (spawnSync per command), run with `node scratch/x.ts`: no shell
  programming anywhere, the repository's scripts included (round 10: a
  tracked `.sh` is one `exec node <script>.ts` line, where the harness
  needs a file; tests/done-line.test.ts checks). Commit messages: write `scratch/msg.txt`
  with the Write tool, then `git commit -F scratch/msg.txt -- <paths>`
  (by pathspec; `git mv` / `git rm` stage on their own, but only the
  index's text: move first, edit after, and commit by the pathspecs of
  both folders, `-- docs/friction docs/friction-done`). Commit in a
  call of its own once the checks passed, never chained after them (`…
  | head && git commit` commits on head's exit status). The words
  `source`, `eval` and `exec` are refused anywhere in a command, as an
  argument too (`node scratch/x.ts source` was): name things otherwise.
- Never a heredoc or a multi-line `python3 -c`, even where one has worked
  before: the guard judges the whole text, so the same form passes once
  and is refused the next time, and in double quotes the shell runs a
  doc's backticks as commands (round 8 wrote `the  assumption ()` into
  open-problems.md). Write the file with the Write tool, then run it with
  one plain command. A field of a fixture or of a `--json` line: `jq`
  (installed; `jq '.hits[0]' fixtures/pending/zmdlogs-0c14*.json`), not
  inline Python. File edits with the Write/Edit tools; a batch of
  replacements (backticks and all): write `scratch/edits-<n>.txt` with the
  Write tool, then `node scripts/edit.ts scratch/edits-<n>.txt` (exact,
  all or nothing, the format in its header: `@@@ <path>`, then
  `<<<<<<<` old `=======` new `>>>>>>>` blocks; `<<<<<<< end` appends).
  `npm test` flags a doc with that damage's shapes (scripts/check-links.ts
  damagedText); `node scripts/bash-guard.ts --check '<cmd>'` says whether
  a command is one of the forbidden forms, and the same script runs as a
  PreToolUse hook on every Bash call (.claude/settings.json, the owner
  2026-11-24): a refused command comes back with the reason and the safe form. No code formatter
  (`.prettierignore` keeps `npx prettier` off): format by hand.
- Scripts as files in `scratch/` (git-ignored, ignored by lint, typecheck
  and premerge; `@efsim/*` resolve there): start from
  `scripts/scratch-template.ts`, run `node scratch/x.ts`. Times go through
  `FPS` (30 frames a second): `withSeconds(scenario, s)` for a fight's
  length, `framesOf(s)` / `secondsOf(f)` otherwise, never a literal `* 60`.
  Operator ids from names: `operatorId(data, "Arcane")` (@efsim/data),
  `efsim find --operators`. A scratch script a doc cites for a number the
  next step builds on moves to `scripts/probes/<topic>/` in that commit,
  with its line in [scripts/probes/README.md](scripts/probes/README.md)
  (scratch/ is per worktree and goes with it).
- Long runs: start them with the Bash tool's background mode (never `&` or
  `nohup`: such a job can't be stopped, and `pkill` is off limits), with
  progress to a new file per run, then wait with Monitor on
  `until grep -q '^EFSIM-DONE <job> ' scratch/x.log; do sleep 15; done`
  with the job's own name (snapshots, premerge, measure, verify-at end with
  `EFSIM-DONE <job> pass|fail|killed` on stdout, with-lock `EFSIM-DONE
  <--name> exit <n>` on stderr, so a redirected stdout keeps only the
  command's output; a foreground `sleep` is refused). Every job that takes the
  test lock (measure too) runs this way from the start, with the 2 h limit:
  the queue's wait counts against it ([limits](docs/design/tests.md#measuring-a-change)).
  measure and team-ab fix the code when queued: keep editing meanwhile. Minutes of CPU (seed
  tables, `gear --rules`): `node scripts/with-lock.ts --name <job>
  <command>`, one job per wrap, never a batch script, never inside
  `timeout`: a queue behind premerges and test suites (measure and
  `--kind short` jobs run beside long ones), an estimated wait and a
  heartbeat on stderr, `--status` shows it.
- The container can restart and kill background jobs silently: commit work
  in progress before a long run, and after a restart `node
  scripts/runstate.ts` says which run was in flight, at which code, and
  whether it finished.
- Timing claims: `npm run bench -- "<cmd A>" "<cmd B>"` (alternating runs,
  CPU seconds and load), never two runs at different times. Another
  commit's code beside this one: `node scripts/at-commit.ts <ref>
  [--patch f]` (a worktree under scratch/at/ with its own packages linked;
  `--remove <dir>` after), then bench both CLIs or both test runs
  (`"cd scratch/at/<hash> && npx vitest run <file>"`); a probe or scratch
  script of this checkout against that commit's code: `--run <script> [--
  args]`. Never copy older source files over the tree for an A/B.
  Game-data questions: `efsim gamedata tree <id>` (`--path` for one
  subtree), `who <id>`, `find <type>`.

Hold-out logs live in `fixtures/holdout/`: never open, list or grep it
(`.ignore` keeps ripgrep out; `grep -r` needs `--exclude-dir=holdout
--exclude='*holdout*'`),
nor diff or open `tests/snapshots/log-verdicts-holdout.json` (their verdicts;
`scripts/accuracy.ts --compare` gives the aggregates). Git names files too:
after a commit that touched `fixtures/holdout/`, no `git status`, `git
diff --stat|--name-only`, `git show --stat`, `git log --stat` or `git
merge` with its diffstat over it without `-- . ':!fixtures/holdout'` (or
`--no-stat`); `npm run merge` and premerge print hold-out paths as a
count only.
`efsim zmdlogs list [--with <operator>]` lists the development logs.

The lead: name the base commit (or branch) in a sub-agent's brief, and
the files each parallel agent is expected to edit (`node scripts/runstate.ts
--touching` lists what other worktrees' branches changed so far), and
merge with `npm run merge -- <branch>…` (one or a batch; rebuilds the
journal, runs the tests related to code both sides changed, says when
snapshots need `npm run snapshots:update`: once per batch).

## Friction reports

When a sub-agent finishes a task, resume it once more and ask for a friction
report: structural problems in the code design, repository, docs or tools
that slowed it down, and how to make future agents' work easier, written to
[docs/friction/](docs/friction/README.md) (format and the request to send
are there). When about five unprocessed reports have collected, launch one
sub-agent to read them, deduce the overall improvements and implement them,
then move the reports to [docs/friction-done/](docs/friction-done/README.md)
(docs/friction/ only holds what still needs doing).

## Data and reference code

- Game data comes from the submodules under `data/`; see
  [data/README.md](data/README.md). Don't copy their data into this repo.
- Existing simulators under `reference/` are a starting point; see
  [reference/README.md](reference/README.md) for what each licence allows.
  `reference/Endaxis` has no licence: read it and compare outputs, but never
  copy its code.
- Web sources: follow the terms summarised in
  [docs/data-sources.md](docs/data-sources.md#licences-and-terms-in-short).
  Lookups are fine (including the Talos Wiki API); no scripted mass
  downloads or anything that puts undue load on a site. If a mass download
  really is the only option, ask the owner first. Use a descriptive
  user agent. Track hosts in [docs/network-allowlist.md](docs/network-allowlist.md).
