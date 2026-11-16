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

## Correctness

The tool is only useful if its numbers are right. Keep tests up to date and
passing with every change. Follow the architectural principles in
[docs/design.md](docs/design.md#architectural-principles).

Tests: `npm test` is the default suite; `npm run test:logs` (`tests/slow/`:
pending logs, negative control, single tests of tens of seconds) and
`npm run check` (both, plus types and lint) run before a merge. While
working, run only what a change touches: `npx vitest run tests/<file>.test.ts`
(one file; `-t "<name>"` for one test) or `npx vitest related --run
<changed source files>` (every test file that imports them). A test file
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

The owner plays daily and may run simple in-game tests. Keep
[docs/in-game-tests.md](docs/in-game-tests.md) current and tell the owner
when a new test becomes ready.

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
merging a branch into `main`, run `scripts/premerge.sh`: about 15–20 min
(more under load), so run it in the background with a limit of 40 min. It
runs every step, re-runs files that only timed out, waits for other
worktrees' suites (a shared lock) and ends with a pass/fail table.

Command shapes the worktree sandbox accepts (others are refused as "too
complex to verify"):

- One plain command per Bash call, run from the worktree, absolute paths.
  No `source`, no heredocs, no `cd … && git …` chains, no loops or pipes
  around `git`, no `git -C`. `git show <ref>:<path> > scratch/x`, then
  process the file.
- File edits with the Write/Edit tools, not `sed`/`python -c` pipelines.
- Scripts as files in `scratch/` (git-ignored, ignored by lint, typecheck
  and premerge; `@efsim/*` resolve there): start from
  `scripts/scratch-template.ts`, run `node scratch/x.ts`.
- Long runs: start them in the background with progress to a file, then
  wait with Monitor on that file (a foreground `sleep` is refused).
- Timing claims: `npm run bench -- "<cmd A>" "<cmd B>"` (alternating runs,
  CPU seconds and load), never two runs at different times.

Hold-out logs live in `fixtures/holdout/`: never open, list or grep it.
`efsim zmdlogs list [--with <operator>]` lists the development logs.

The lead: name the base commit (or branch) in a sub-agent's brief, and
merge with `npm run merge -- <branch>` (rebuilds the journal; says when
snapshots need `npm run snapshots:update`).

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
