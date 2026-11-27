## 2026-11-27: Improvement round 17: numbers that move, questions across logs, one cause per line

**Goal:** improvement round 17 over the five open friction reports (Arcane's stage factors, round 16's own, away
statuses, exposed totals, Zhuang Fangyi and Liino) and round 16's backlog; every file the round's
(docs/friction-done/2026-11-27-round-17.md has the details).

**Done:**
- **Numbers that move:** two describing snapshot keys, `other-hit operator <id>` (hits matched only as their event's
  other kit hit: the class that hid Zhuang Fangyi's attack 4) and `stage` (enginecheck.ts stageFight); the
  scoreboard's by-operator table names each operator ("chr_0032_lizhiyan (Arcane)"), with "As other kit hit" (per
  group too: development 100, hold-outs 19) and "Without stage fights"; `zmdlogs groups` prints the count and casts
  first, and mismatches inside a fight-wide factor stretch apart.
- **Across logs:** `node scripts/cli-ab.ts <ref> --placement` (every log's CAST/HIT lines that differ, by rule and
  operator, 12 s); `efsim zmdlogs away` (31 stretches: 2 pause, 11 runs on, 4 mixed, 14 no clock); BATCH in `zmdlogs
  decisions` (20 in 10 logs); `zmdlogs offsets --all` ends with the factor stretches no fixture holds (14 in 8 logs).
- **One cause, one line:** `totals`' total ÷ Max HP and kill kind; `hits --against-hit`; stageNote in `replay` and
  `bursts`; the CAST line's `[paths: …]`; holds' WIDE units; `--kit-buff` by an owner's name; kit-census's dead kit
  buffs; groups' log-only buffs.
- **Paperwork and helpers:** `friction.ts carry --lists [--park] [--drop]` (this backlog made with it), "done but
  <part>" outcomes, tests/helpers/replay.ts fakeReplay, packages/logs/src/labels.ts; tests/logcasts.test.ts split (56 s
  → 29 + 33 s).

**Checks:** `npm run snapshots:update`: "No log's verdicts moved", "keys added only in 45 log(s) … other-hit operator
<id> ×58, stage ×8"; docs/accuracy.md's old columns identical row by row. team-ab against 44a72be (an engine reading's
description changed): unchanged.

**Decisions:** the names come from the game data's cache (the snapshots stay the scoreboard's only numbers);
`isDescribingKey` holds every kind that isn't a verdict, and a hold-out's moved key is printed by kind (a lone `share
operator` key named its id before). The away probe is deleted, the view cited in its place; the stage probe stays
(the docs cite its numbers). The verdict of an away stretch is "pause" when most clocks ask half its length, "runs on"
when every one asks under a quarter.

**Left** (docs/friction/2026-11-27-backlog-after-round-17.md): a layered buff's per-layer clock; the recorded Stagger
start parked; on the accuracy list the element mask of log-only buffs and the 14 factor stretches (7b54's slug first).
CLAUDE.md lines for the lead in the round's summary.
