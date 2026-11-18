## 2026-11-18: Improvement round 4: a query layer over the logs

**Goal:** the fourth friction round (docs/friction/README.md): twelve open reports (round 3's own, three re-triages,
seven test-deciding and diagnosis rounds) and round 3's backlog, ranked by what they cost accuracy work (diagnosing
log mismatches, deciding in-game tests from the logs), behaviour-preserving. Summary:
docs/friction-done/2026-11-18-round-4.md.

**Done** (a commit each):
- A query layer over the log itself (packages/logs/src/query.ts): `efsim zmdlogs instances` (each real cast:
  `loggedSkillInstances`, combos from hits, an ultimate's repeated events folded in, hitless events apart, Arcane's
  Imprisonment end marked), `census --select cast:|event:|buff:<re> [--near …]` (its output records the selection and
  a rerun line), `buffs` (listed id → kit buff), `lanes`, `control`, `cadence`; `devFixtures()`; `zmdlogs list --ids`.
- Every command takes a log's id (`0c14`) or path and operators by name; `zmdlogs hits` needs fixtures or `--all`,
  has `--event`, `--fixtures-from`, a per-fixture cache keyed by the code (12 s → 0.6 s on a second run) and the log's
  own reading per hit (`logReading`, `--reading log`: off under both readings is the build or a kit value).
- The replay flags casts made against the kit (FORCED: unavailable; INSIDE: before the running action lets it) and
  traces a kit buff's expiry step by step (`zmdlogs replay --trace-buff`). `efsim kit <operator>` prints the compiled
  kit with each hit's frames.
- Test lock: a short lane (measure beside long rule searches, never beside premerge or test suites), estimated waits,
  stderr heartbeats, `EFSIM-DONE <job> killed`, with-lock `--name`. The hold-outs' verdicts in their own snapshot file.
- `efsim repair` (gear.ts repairRotation exported), `npm run smoke` (90 s: what timing changes broke far away),
  `scripts/team-ab.ts` (an identity check of the team pages' fights before the 32-seed runs), measure's mixed logs with
  their mean per-hit error, `snapshotEntry` shared by the log suites and measure, each CLI command checking its own
  option values.
- Docs: data.md "Common misreadings", "Questions and the command that answers them", "A claim from the logs cites
  its selection"; data/README "Adding a table"; CLAUDE.md (smoke, team-ab, repair, the CLI in a worktree, batch
  edits, waiting for the job's own name).

**Decisions:** event repeats are folded into a cast only for ultimates (folding by skill duration also swallowed Si's
periodic events and Liino's stance presses, which are the question); the breakthrough table, the `inUltimate` cue
and Liino's beats as a ticking buff stay in the backlog (shared checkout state, team numbers, verdicts would move);
the short lane lets a measure run beside a long job (its verdicts don't depend on CPU load; timing runs take
`--exclusive`).

**Behaviour:** `npm run measure` byte for byte after each replay or check change; `npm run snapshots:update` at
3cd4610 changed no snapshot and not docs/accuracy.md ("No log's verdicts moved"); `node scripts/team-ab.ts --base
c83c9e5` found every team page's fight identical (each hit of the example timelines, a 300 s rules seed, full and zero
energy). Scoreboard unchanged.

**Problems:** the worktree guard refused heredocs and multi-line commands from about a third of the way in (the same
shapes had passed before); everything after went through scratch files, as CLAUDE.md says.
