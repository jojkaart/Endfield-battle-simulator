# Does Si's Haste need Initial Stroke? (2026-11-16)

Task: check, from the game data and the ZMDLogs logs, whether Si's talent
Haste (`talent_haste`, BuffData `buff_chr_0036_jsspsi_talent1_speedup`)
needs Initial Stroke, classify every Artful Intent end in the Si logs, and
fix the kit if it was wrong. Branch: the worktree branch of
`.claude/worktrees/agent-a29e03cb3b6f25613` (commit 539c149). The data
answered the question and the kit was right. The logs couldn't answer it.

## 1. The fixtures drop the buffs and fields the question needed, and the raw logs aren't kept

- **What happened:** the brief asked me to look up, in each log, when the
  Haste buff appears, on whom, and for how long. The log fixtures
  (`fixtures/*.json`, schema `schemas/log-fixture.schema.json`) only have
  per-hit `effects`, `boundaryEffects` and `unquantified`. The importer
  `zmdlogsToFixture` (`packages/data/src/zmdlogs.ts`) keeps a buff only if
  it has damage `effects` or `dynamicEffects`, and only on the hits
  inside it. A Haste (SpeedupAction, no damage zone) can't appear in a
  fixture at all. I found that out only after reading the importer. I
  then had to fetch the raw details again from the API (four battles,
  with a hand-written fetch script) to learn that ZMDLogs doesn't record
  the Haste either. The raw detail also had the one field that tells
  Final Stroke from an Inksoul expiry: a burst's
  `poiseDamage.orig_source`, which is `normal_skill_2` or
  `normal_skill_inkmove_2`. The importer keeps only `{dealt, bar}`
  (`poiseOf`), so for the 30 other Inksoul bursts in the fixtures, the
  path was left as "Final Stroke or expiry". Separately, every Si
  battle-skill variant is logged as `chr_0036_jsspsi_normal_skill` in
  `casts`, so a fixture can't show whether Initial Stroke or Final Stroke
  was pressed either.
- **Cause:** the fixture format was designed for damage checks only, and
  the raw `detail` from `fetchBattle` is used once at import and then
  thrown away (`efsim zmdlogs refresh` takes a downloaded detail but
  keeps none). Mechanism questions (which buffs a log shows, what started
  a hit) need data that is no longer anywhere in the repo or on disk.
- **Suggestion:**
  1. At import, cache the raw detail in a gitignored local folder (e.g.
     `.cache/zmdlogs/<battleId>.json`, written by `packages/cli/src/logs.ts`).
     Add `efsim zmdlogs raw <fixture> [--buffs pattern] [--events pattern]`,
     which prints buff lanes (key, target, source, start, end) and events
     with their `orig_source`. It should fetch once if the file isn't
     cached and must refuse hold-out IDs.
  2. Add `origin` (from `poiseDamage.orig_source`) to `LogHit.poise` in
     the schema and importer, and fill older fixtures with
     `zmdlogs refresh`.
  3. In `docs/data-sources.md` (ZMDLogs section), add one line: "ZMDLogs
     records only buffs it can value. Haste, Si's Artful Intent and
     Inksoul are absent from the raw log (checked 2026-11-16)."
- **Why it helps:** questions like "does buff X appear after Y" could be
  answered from disk in one command, without re-downloading. Re-download
  load on the site also goes away, which matters under the
  no-mass-download rule. Risk: the cache holds player names, so it must
  stay gitignored and out of reports.

## 2. The worktree sandbox refuses the documented setup and common shell forms

- **What happened:** CLAUDE.md says to run `source scripts/setup-worktree.sh`.
  The worktree isolation guard refused it ("runs a string through source,
  which can't be verified to stay inside the worktree"). I had to copy
  the script's symlink loop by hand (`ln -sfn` for cli, data, engine) and
  put `export EFSIM_DATA_DIR=/home/user/Endfield-battle-simulator/data`
  in front of every `node packages/cli/src/main.ts`, `npx vitest` and
  `scripts/premerge.sh` call. The guard also refused, as "too complex" or
  "names git", these commands:
  - a `cd` into `data/rmxlinux-EndfieldData`;
  - Python heredocs (`python3 - <<'EOF'`);
  - a `curl` loop whose user-agent URL contained "github".

  Each refusal cost a retry, and in the end I wrote every scratch script
  as a file in the scratchpad. About ten minutes in all.
- **Cause:** the setup is a sourced script that sets shell state
  (`export`). Shell state doesn't persist between an agent's Bash calls
  anyway, and the guard rejects `source` outright. CLAUDE.md doesn't say
  either thing.
- **Suggestion:**
  1. Split `scripts/setup-worktree.sh` into an executable part that makes
     the links (runnable as `scripts/setup-worktree.sh`, no `source`).
  2. Let the CLI and tests find the main checkout's `data/` by
     themselves when `EFSIM_DATA_DIR` is unset and the cwd is a worktree:
     in `packages/data`, resolve `git rev-parse --git-common-dir` and use
     `<main>/data` when the local `data/rmxlinux-EndfieldData` is empty.
  3. In the CLAUDE.md "Worktrees" section, say that heredocs and `cd`
     outside the worktree are refused, and that scratch scripts should
     go in files with absolute paths.
- **Why it helps:** every sub-agent hits this at its first step. With
  auto-detection, a forgotten `EFSIM_DATA_DIR` can no longer make the
  checks find no game data. Risk: auto-detection must not pick up the
  main checkout's packages, only its data.

## 3. Hold-out logs share a folder with development logs

- **What happened:** I first ran a `grep` over `fixtures/*.json
  fixtures/pending/*.json` for speed-up buffs. The permission classifier
  rejected it as undermining oversight, because hold-out logs (listed in
  `fixtures/pending/holdout.json`) are mixed into `fixtures/pending/`.
  Every later scan needed a script that reads `holdout.json` and skips
  those files by name before opening anything
  (scratchpad `silogs.py`, `classify.py`).
- **Cause:** whether a log is held out is recorded only in a JSON list,
  not in where the file lives. So any glob or grep over the fixtures
  touches hold-outs.
- **Suggestion:** move hold-out fixtures to `fixtures/holdout/`, which
  the slow tests' aggregate measurements read explicitly. Add a
  CLI listing, e.g. `efsim zmdlogs list [--with <operator>] [--dir
  dev|pending|multi]`, that never includes hold-outs and prints ID,
  team, potentials and casts count.
- **Why it helps:** "which logs have operator X" is the first step of
  most diagnosis tasks. A safe glob removes both the risk and the
  boilerplate. Cost: one move, plus updating the paths in
  `vitest.logs.config.ts` and its tests.

## 4. Reading BuffData action trees by hand

- **What happened:** to find what creates `talent1_speedup`, I wrote two
  scratch tools:
  - a string search that prints JSON paths (`find.py`);
  - a compact tree printer showing each action's `$type` and fields
    (`tree.py`).

  The enum meanings I needed were not in any one place: buffEvent 0
  start, 1 tick, 2 finish, 5 on enable, and CompareFloat `compare` 4 =
  equal. I found them in `docs/kit-batches/batch-4/chr_0017_yvonne.md`
  and `batch-1/chr_0035_liino.md`, marked "inferred". About 15 minutes
  before the two creation sites and their conditions were clear.
- **Cause:** there is no repo tool to print a BuffData or SkillData
  entry as a readable action tree, and no single enum map.
- **Suggestion:** add `efsim gamedata tree <buff or skill id> [--grep
  pattern]`, which prints the event → action → condition tree with enum
  names, skips VFX and audio, and can answer "who creates buff X"
  (reverse index over BuffData and SkillData `buffId` fields). Also
  collect the enum readings in one table in `docs/combat-mechanics.md`,
  each marked inferred or verified with its evidence.
- **Why it helps:** every kit analysis starts with this. A reverse index
  would have answered "who creates the Haste" in one command. Cost: an
  enum table that has to be kept honest about what is inferred.

## 5. A test read expired buffs from the final state

- **What happened:** my first `tests/kit-si.test.ts` ran 40 s and then
  looked for `talent_haste` in `TimelineState.buffs`. It found none even
  where the trigger had fired (`triggerState["chr_0036_jsspsi:inksoul_haste"].count`
  was 1). That looked like a kit bug until I saw that `advance` prunes
  expired buffs, so `buffs` holds only buffs still active. I rewrote the
  test to run twice: once whole to find the burst frame, then up to that
  frame.
- **Cause:** the engine has no history of buff instances. Tests (and
  diagnostics) can see a buff only while it is active.
- **Suggestion:** add `buffLog` to `TimelineState`, or an opt-in context
  option. It would be a list of every instance's id, owner, appliedAt
  and end. Or add a test helper in `tests/` that advances and collects
  the active buffs at each frame. Also document the pruning on
  `TimelineState.buffs` in `packages/engine/src/timeline`.
- **Why it helps:** it avoids false "the kit never applies it" alarms.
  Assertions get one-pass and simpler. Cost: memory in long searches, so
  the log should be opt-in.

## 6. What-if kit variants need editing the real kit file

- **What happened:** to measure what the Haste is worth, I made the Haste
  fire on every Artful Intent end. That meant editing
  `packages/data/kits/operators/chr_0036_jsspsi.json` in place (`sed` on
  one line), running `efsim rules` twice (about 1 minute each with
  `--seeds 10`), and reverting with `git checkout`. A forgotten revert
  would have gone into the commit.
- **Cause:** the CLI reads kits only from `packages/data/kits`, and has
  no way to point one run at a modified copy.
- **Suggestion:** add `--kit <file>` (repeatable) to `simulate`,
  `rules` and `search`, overriding one operator's kit for that run.
- **Why it helps:** sensitivity questions ("what if the data means
  otherwise") are frequent with the owner. It removes a way to commit an
  experiment by mistake. Cost: small, since kits are loaded in one place.

## 7. premerge takes longer than a background run's default limit

- **What happened:** I started `scripts/premerge.sh` in the background
  with a 10-minute limit. The plain `vitest run` stage alone took about
  6.5 minutes (387 s), and `test:logs` was still running when the limit
  stopped it. I had to start it again with a longer limit; the full run
  then passed.
- **Cause:** nothing tells agents how long premerge takes, and it prints
  no stage timing.
- **Suggestion:** state the expected runtime (about 15 minutes or more,
  on this container) next to the premerge line in CLAUDE.md. Also have
  `scripts/premerge.sh` print each stage's elapsed time.
- **Why it helps:** saves one wasted run per agent. Cost: none.

## What worked well

- Kit notes cite their BuffData and SkillData sources and the fixtures
  they were checked on. That made the claim easy to verify and showed
  exactly which objects to open.
- `efsim rules` with `--seeds` gave a quick, comparable measure of what
  the question is worth (±3%).
- `scripts/premerge.sh` bundling typecheck, lint, tests, log tests and
  tool tests in one command, with a clear "ready to merge" line.
- `fixtures/pending/holdout.json` listing hold-outs explicitly, so a
  script could skip them by name.
