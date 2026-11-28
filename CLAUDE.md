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
  Diagnosis briefs ask for both. A fixed item shrinks to one line naming
  its journal entry; its open points move to the round's "Still possible".
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
- The engine's open readings: `packages/engine/src/assumptions.ts` (the
  simulation's) and `replay-assumptions.ts` (those only the log check
  reads), outside timeline/; each reading's evidence in
  docs/design/assumptions.md (no cache rebuild, no team-ab for its
  prose). Every reader takes the run's readings through `readingOf`
  (`@efsim/engine`), never a default of its own
  (tests/assumption-readers.test.ts).
- `packages/logs` (`@efsim/logs`): log import and the log check.
- `packages/cli`: one module per command in `src/commands/<name>.ts`
  (usage lines, options, run), listed in `src/commands/index.ts`.
- `docs/design.md`: the principles and an index; each subsystem is in
  `docs/design/<topic>.md`. `node scripts/check-links.ts` (a test runs it)
  checks that relative doc links resolve.
- A module split is a move: `node scripts/split-module.ts <file.ts> --to
  <new.ts>=<name>,… [--dry-run]` (`--reexport` beside another agent's
  files: no importer changes, the original re-exports the moved names
  until the merge), then `npm run measure -- --base HEAD`
  (no log moves). A quicker first check of any behaviour-preserving move:
  `node scripts/identity.ts --base HEAD` (the compiled data and every
  log's replay record hashed at both, about 4 min, the hold-outs a count).

## Correctness

The tool is only useful if its numbers are right. Keep tests up to date and
passing with every change. Follow the architectural principles in
[docs/design.md](docs/design.md#architectural-principles).

Tests: `npm test` is the default suite; `npm run test:logs` (`tests/slow/`:
pending logs, negative control, single tests of tens of seconds) and
`npm run check` (both, plus types and lint) run before a merge. While
working, run only what a change touches: `npx vitest run tests/<file>.test.ts`
(one file; `-t "<name>"` for one test) or `npx vitest related --run
<changed source files>` (every test file that imports them; a change to a
view or report of packages/logs touches most of the suite that way, so
there first the test files naming the changed function, `rg -l '<name>'
tests`, and `related` once before premerge), and `npm run
lint:changed` (ESLint on the files changed since `main`, seconds, and the
assumption registries' tests when a registry changed, the fakeReplay tests
and the typecheck when BuffReplay or tests/helpers/replay.ts changed).
After a
change to the engine's timing rules (packages/engine/src/timeline/, kit
timing): `npm run smoke` (under 2 min: kit tests, loop searches, the
owner's rules check, the examples) before premerge; an example that stops
playing: `npm run -s efsim -- repair examples/<file> --write`. A kit or
engine change's team numbers: `node scripts/team-ab.ts --base <ref>` (an
identity check first: the 32-seed runs only when a team's own fight
changed; it prints the table). A
background test run: add `--reporter=default
--reporter=./scripts/vitest-progress.ts` (a line per finished file); a plain
`npx vitest run` reads the tree as it goes: don't edit meanwhile, or run it
at a snapshot, `node scripts/verify-at.ts --snapshot --files <a,b>` (smoke
fixes its code at queue time too). A test file
that takes over ~40 s gets split, and a single test of tens of seconds goes
to `tests/slow/`. Shared test builders live in `tests/helpers/` (synthetic
kits and logs, buff history); after a split, `npm run prune-unused --
<files>` drops the imports and helpers each half no longer uses. Vitest shows a passing file's `console.*` output only
with `--silent=false`: a line every run must show goes through
`process.stdout.write`.

Snapshots (`tests/snapshots/*.json`) and the accuracy scoreboard
([docs/accuracy.md](docs/accuracy.md)) are generated: `npm run
snapshots:update` regenerates them all from the current code (it prints
the scoreboard's change and which logs got better or worse; it reads the
working tree and fails when the code changed since it was queued: edit
docs only meanwhile). On a merge
conflict in any of them, take either side and run it; never merge them by
hand. Quote the scoreboard's numbers, not scratch sums, in the journal.
A reclassification apart from a change: `node scripts/accuracy.ts
--compare <ref> --regroup`. A tool that prints log keys tells a hold-out
by `isHoldoutKey` (scripts/accuracy.ts), never by a key's prefix;
tests/holdout-blindness.test.ts lists every export of accuracy.ts and
measure.ts as a printer it runs or with why it prints no log.
To try an idea, measure instead: `npm run measure [-- --with <op>]`
(about a minute for every log, writes only `scratch/measure/`; a
measure of at most three logs named with `--logs` runs at once, outside
the test lock; `--at
<ref>` / `--base <ref>` for other commits' code, `--assume <id>=<r>` for
an open reading, `--variant <id>=<r>` (repeatable; `--variant-patch
<diff>`, repeatable, for several patches on one base, one base run;
`--plain-from <dir>` reuses an earlier variant run's plain tree for the
same code, readings and logs, `--trust-plain` across a new reading's
branch) for several in one run
instead of chained measures (each also against the same code without it;
`--set <file>:<CONST>=<value>` for a constant's value, also as a variant),
`--split files|commits|hunks` for which part of a batch moved which log
(`hunks`: each diff hunk alone, a `split:<name>` comment joining a rule's
hunks; a part whose replay threw is "not measured alone"; the refs are
pinned at queue time; its
first line says when the snapshots compared against aren't the code's
own: `--base HEAD` is then this tree's change alone),
`--several-targets` for a change gated on the fixture mark (the three
several-targets logs; the final measure stays full; `--set`'s value is
source text: `--set 'x.ts:MODE="any"'`),
`--patch <diff>` for a change that is none:
[docs/design/tests.md](docs/design/tests.md#measuring-a-change); a change
measured and dropped keeps its diff in [docs/tried/](docs/tried/README.md);
before measuring a rule change, `node scripts/tried.ts --touching
<file>[:<function>]` lists the tried diffs that touch it, and `node
scripts/tried.ts new <slug> -- <files>` keeps one, never `git diff >` over
an existing name; a stale one: `node scripts/tried.ts refresh <diff>`
makes it again on HEAD or names the conflicting files),
and run `snapshots:update` once for the final commit (`-- --costs` only
to rebalance the pending shards); `npm run measure -- --help` lists its
options, checked before it queues; with no reference named and stale
snapshots it measures against the merge base with main (`--against-snapshots`
keeps the snapshots). Which hits a change moved and how their landings
did (lost, with the NOLAND reason; a shift onto another logged hit's):
`npm run measure -- --hits` or `zmdlogs hits <fixture> --against
<id>=<r>`. Diagnosis views: `efsim zmdlogs
groups|differences|casts|replay|stagger|bursts|holds --why`, `clocks`
(each clock's lateness by stop kind; `--fit`: per combo, per episode or
a share; `--around break`; `--json`), `replay <fixture> --sp` (each SP
grant's source, each spend; TOPUP: a cast the replay's SP couldn't pay),
`replay <fixture> --windows <operator>` (a combo's windows: what opened
or refreshed each and by what, an event its cooldown kept out, each
press with the window it found), `decisions` (COOLDOWN: a cast before
the replay's own cooldown had it ready; LOST: a logged crit or reaction
level no landing took, a moved landing's lost facts), `casts <fixture>
--passes` (each placement pass's casts and the stops pass 2 read), `casts
--event-lags --against-holds` (a cast event's world lag from the start
unheld and held by teammates' stops), `efsim kit <operator> [--levels]`
(each skill's cooldown and cost),
`totals --all --side log|replay` (what is still one-sided), `efsim
gamedata curve <id> --frame n` (a dilation's curve), `holds --dropped --all`, `away
<fixture…|--all>` (an away stretch's clocks: a pause or a phase), `hits
<fixture> --against-hit <s>` (a hit's zones against a neighbour's), `ends
<fixture> [--at <s>]` (which listed buffs end at a moment, which go on),
`stack <owner:stack> <fixture…|--all> [--at-cast <re>]` (a kit stack's
value at each cast), `casts --choices` (a late join's rule, REALIGN),
`replay` (TAILKEPT: a tail a guard kept), `decisions <fixture>
--why-kept` (per kept tail, the replay with it cut: which logged hits
lose their landing), `hits <fixture…> --layers <owner:id>` (a layered kit
buff: the log's count, the replay's, the value's), `statuses <fixture>
--inflictions` (a stack's arrival per target), `statuses --controls
<fixture…|--all>` (each control status, and whether it froze), `hits
<fixture…> --targets` (the check's target against the replay's),
`worldtime <fixture> <a> <b> --holds --without <op>` and `worldtime
<fixture> --series <event>` (world time with the hidden holds and one
operator's stops out), `clocks --breaks`, `casts --event-lags --all`
(each operator's event lag by skill kind: check before calling a press
late), `replay <fixture> --trace-trigger <spec> --against-starts <buff>`
(a trigger's firings against the log's starts of its buff); which view
answers a question: `zmdlogs which "<question>"`; `efsim gamedata handlers
abilityEvent <n>` (every listener of one event, ALL DISABLED where
nothing runs),
`hits <fixture> --same-listing <s>` (the nearest hits with the same
listing: check a listing lead there first), `boundaries` (a boundary
rule's base rate), `replay --trace-stack owner:stack`, `replay --kit-buff
<b> --against-lanes` (each pair's ends: ENDS DIFFER), `offsets --all
--bound` (the factor interval that fits every clean hit within ±1),
`decisions --all` (TAILKEPT by guard: `[shown-own]` a tail kept on the
cast's own landing), `node scripts/cli-ab.ts <ref> --hits-zones <fixture>`
(which kit buff moved each hit), `followups
<fixture…|--all> --operator <op>` (a kit trigger's own landings against
the events that fired them), `holds <fixture> --steps <from>-<to>` (the
hidden holds' per-frame steps); `efsim gamedata enemy <enemy|fixture>`
(an enemy's tables and its stage's text: read it first for a stage log),
`gamedata tree <abilityentity_…>` (an entity's spawns); every view
that replays takes `--assume`; what an operator's non-plain matches
assume: `zmdlogs assumed --operator <op>`; what a reading changes: `zmdlogs decisions
<fixture…|--all> --assume <id>=<r>` (the replay's decisions) and `hits
<fixture> --against <id>=<r>` (the hits); one command at two
commits' code, the lines that differ: `node scripts/cli-ab.ts <ref> --
<efsim args>` (`--holds <fixture>`: which bounds a change moved;
`--placement`: every log's cast placement and the rules that moved). A new
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
inputs, icons, the screen), after trying the logs. A log imported for any
task is also checked against the "ready" tests whose question a log
could answer (round 11: test 69 sat ready for a month on a question a
later log, a27b, had decided).

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
(`efsim kit-census`; its last section names a kit buff only disabled
create actions make).

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
  `<<<<<<<` old `=======` new `>>>>>>>` blocks; `<<<<<<< end` appends,
  closing at the next `@@@` line or the file's end).
  `npm test` flags a doc with that damage's shapes (scripts/check-links.ts
  damagedText); `node scripts/bash-guard.ts --check '<cmd>'` says whether
  a command is one of the forbidden forms, and the same script runs as a
  PreToolUse hook on every Bash call (.claude/settings.json, the owner
  2026-11-24): a refused command comes back with the reason and the safe form;
  it ran nothing, its other commands included: run them again (`node
  scripts/bash-guard.ts --check-file <file>` tries a form). No code formatter
  (`.prettierignore` keeps `npx prettier` off): format by hand.
- Every script answers `--help` from its header.
- Scripts as files in `scratch/` (git-ignored, ignored by lint, typecheck
  and premerge; `@efsim/*` resolve there; a `.md` there is refused:
  draft a doc in its final path): start from
  `scripts/scratch-template.ts`, run `node scratch/x.ts` (`node
  scripts/typecheck-scratch.ts scratch/x.ts` typechecks it). Times go through
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
  command's output; a foreground `sleep` is refused; a plain command's own
  completion notice is enough, Monitor only for a job with an EFSIM-DONE
  line; never `| tail` a background test run, give it
  `--reporter=./scripts/vitest-progress.ts` and a file). Every job that takes the
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
  whether it finished; `node scripts/runstate.ts --where` adds the
  branch, the commits beyond main, the uncommitted paths and each run's
  output tail and EFSIM-DONE line, in one call.
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
(`.ignore`, fixtures/.ignore and tests/snapshots/.ignore keep ripgrep
out from any root, several roots included; `grep -r` needs `--exclude-dir=holdout
--exclude='*holdout*'`),
nor diff or open `tests/snapshots/log-verdicts-holdout.json` (their verdicts;
`scripts/accuracy.ts --compare` gives the aggregates). Git names files too:
after a commit that touched `fixtures/holdout/`, no `git status`, `git
diff --stat|--name-only`, `git show --stat`, `git log --stat` or `git
merge` with its diffstat over it without `-- . ':!fixtures/holdout'` (or
`--no-stat`); `npm run merge` and premerge print hold-out paths as a
count only. A tool's hold-out output is aggregates only: never a
hold-out's change split by cast, skill, operator or rule kind, hashed or
not (round 20; the friction backlog's "Declined" section carries it).
`efsim zmdlogs list [--with <operator>]` lists the development logs.
Before importing a log: `efsim zmdlogs screen <battle id…> [--fetch]`
(the "Choosing logs" checks; a hold-out refused unread, no account named).

The lead: name the base commit (or branch) in a sub-agent's brief (check
each accuracy lead first: `node scripts/lead-status.ts <id@time|words>…`
says whether docs/open-problems.md marks it fixed, open or both; a theme
a friction brief adds beyond the reports names its episode), and
the files each parallel agent is expected to edit (`node scripts/runstate.ts
--touching` lists what other worktrees' branches changed so far; `node
scripts/lead-files.ts <fixture id|operator|word>…` the code files earlier
commits naming a lead changed (and by family: replay, placement, check,
holds, views, timeline), so a split by files sees where the causes
tend to live; a brief lists files, never a family of them ("the replay
modules": `node scripts/lead-files.ts --family <name>` prints one; `--split
<agent>=<files|family:x>,…` flags a lead whose earlier fixes touched two
agents' files: SHARED; split it by question, or name the shared hot files,
logcasts.ts or buffreplay.ts, in both briefs as "may touch with a note":
an edit there is one function, committed alone, its message naming the
other agent); where
the cause is unknown, split by question; a fix in
another agent's file goes back as a measured diff in docs/tried/, "held
back", for the lead to apply after the merge), and
merge with `npm run merge -- <branch>…` (one or a batch; rebuilds the
journal, runs the tests related to code both sides changed, says when
snapshots need `npm run snapshots:update`: once per batch). Once a
branch's merge is committed and tested (its premerge passed, the merge's
related tests passed, pushed), remove its worktree and the `scratch/at/`
copies inside it (`git worktree remove`; the branch stays), so finished
worktrees don't fill the disk (the owner, 2026-11-26: 66 of them, 28 GB).

## Friction reports

When a sub-agent finishes a task, resume it once more and ask for a friction
report: structural problems in the code design, repository, docs or tools
that slowed it down, and how to make future agents' work easier, written to
[docs/friction/](docs/friction/README.md) (format and the request to send
are there). When about five unprocessed reports have collected, launch one
sub-agent to read them, deduce the overall improvements and implement them,
then move the reports to [docs/friction-done/](docs/friction-done/README.md)
(docs/friction/ only holds what still needs doing). A tooling round may add
a snapshot key that only describes, when snapshots:update says "keys added
only" and "No log's verdicts moved"; its summary names the keys. The new
backlog: `node scripts/friction.ts carry <backlog> <n,…|none> --lists
[--park <n,…>] [--unpark <words>]` (`--unpark`: a parked point a new report
hits, its full text on stderr).

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
