## 2026-11-27: Improvement round 18: records of rules that decline, one run for several answers

**Goal:** the five open friction reports and round 17's backlog (docs/friction-done/2026-11-27-round-18.md), on main
at 5cf680e, every file this round's; no number to move.

**Done:**
- **Rules that decline leave a record:** TAILKEPT decisions (replayrun.ts tailCuts' kept tails and their guard),
  PlacedHit.joined (the rule that joined a landing to its cast and its times: `zmdlogs casts --choices` prints the
  joins over 1 s late, 399 HIT lines over the development logs, 204 `to come`), REALIGN lines (Placement.realign), the
  one-sided `kill` flag and `zmdlogs away`'s logged kills.
- **One run, several answers:** `measure --set <file>:<CONST>=<value>` and as a `--variant` entry (its own patched
  worktree; two STATUS_WIDE_FRAMES values in one run), `measure --split hunks` (`split:<name>` markers), `node
  scripts/accuracy.ts --compare <ref> --regroup` (against 107766a it gives the status-pairing journal's scratch numbers:
  development plain 81.5 → 82.4% by the 9c6e mark alone, log-only 3.13 → 2.02%), the shares' groups in --compare.
- **Blind-safe hold-out traces:** the moved hold-outs' replay decisions by kind, net per direction, and per split part
  how many of the whole change's moved hold-outs it moves the same way.
- **Structured output:** `totals --all --json`'s `share`, `logged`, `fightError`, `stage`, `severalTargets`,
  `totals --skip`; `zmdlogs casts --json` (castsRecords), compared by field in `cli-ab --placement`.
- **Across logs:** `zmdlogs stack <owner:stack> [--at-cast]`, the bursts header's pairing rule and twin bursts,
  clocks' Stagger-break rows (cast clocks with a break inside run +186 ms at the median, 40 rows, against +10 ms in
  4,785 without: docs/open-problems.md's Yvonne paragraph); bash-guard refuses a stale `git commit -F` message.

**Checked:** `npm run snapshots:update` at the final code: "No log's verdicts moved", the snapshot files and
docs/accuracy.md byte for byte the same; `node scripts/cli-ab.ts 5cf680e --placement`: every log's placement the
same; no engine file touched (no team-ab); premerge at the final commit.

**Decisions:** no stable label per hold-out (replay-only report point 1): with `--with <operator>` choosing which
hold-outs a measure runs, a label that persists would tell which hold-outs have which operator; the per-part counts
answer "is it this part's hold-out" within one run. The casts' skill kind beside the hold-outs' decision counts isn't
printed either (a split per mechanism class, docs/design/tests.md's "never" list). The assumptions' evidence text
stays in the engine's source this round: comments alone don't cover it and a string-blind digest could miss a real
change (backlog point 2).

**Found on the way:** measure's splitLines named a hold-out moved by the whole change and by no part, and splitParts
counted every hold-out as moved (allLogs keys a hold-out under pending/; the code tested the key): fixed, with a test.

**Left:** docs/friction/2026-11-27-backlog-after-round-18.md: the per-layer clock (carried), an assumption's
evidence text out of the engine's source, `holds --steps`; the accuracy list gained a hold at a Stagger break.
