## 2026-11-28: Improvement round 22: clocks, screening, views that say why, a move's identity check

**Goal:** the five open friction reports and round 21's backlog (docs/friction-done/2026-11-28-round-22.md), tools
only: no verdict moves.

**Done** (round summary for the details):
- Clocks: packages/logs replayclock.ts (the timeline's applied stops and the hidden holds as TimeStops, a hold added
  to any stop), `zmdlogs worldtime … --holds --without <op>` and `worldtime <fx> --series <re>` (fc63's array across
  Typhoeus's ultimate: 4.29 s world with every stop out, 6.36 s with hers left in, 4.00 s expected), holds.ts
  tickChains as the one chain rule, `zmdlogs clocks --breaks` (5082's Yvonne at the break +0.5 → +0.05 s), `zmdlogs
  casts --event-lags` (Typhoeus's combo +0.53 s, Arcane's +0.29 s), docs/design/timeline.md "Which clock each hold
  holds" (and the burst sentence's own-ultimate reading, stale since `burst-stops` `all`).
- Screening: `efsim zmdlogs screen <battle id…> [--fetch]` ("Choosing logs" as checks; a hold-out refused unread; an
  account only as a count), missingEnemyFacts in the screen, import, `gamedata enemy` and the check's head ("The
  replay stopped: at t s: …").
- Views that say why: the TAILKEPT `needed` line with the lost hit's pairing before and after the cut; `hits
  --targets` (HitRecord.target.replay, .replays); `statuses --controls` (6339 4.53 s, 7b54 3.40, 29.50 s);
  `replay --trace-trigger … --against-starts <buff>` (8056: Frontiers' two extra firings at the SP cap).
- Measuring: `measure --variant-patch` (two on 0eef in one run), scripts/identity.ts (the data and every log's replay
  record by part at a base and the tree; the hold-outs a count), lint:changed running the fakeReplay tests and the
  typecheck, kitMatch.ts HIT_FACTS_ARE_DATA_FIELDS with a schema-enum test, `efsim zmdlogs which "<question>"`.
- Paperwork: docs/friction/2026-11-28-backlog-after-round-22.md (points 1–2), the reports and round 21's backlog in
  docs/friction-done/ with their outcomes.

**Checked:** `node scripts/identity.ts --base c81a34f` at c3ba762: the data, 65 development logs and 13 hold-outs the
same. `npm run snapshots:update` at a640e94: verified, development, hold-out, earlier pending and several targets
"unchanged", "No log's verdicts moved", no snapshot file or docs/accuracy.md changed; no engine file changed (no
team-ab).

**Decisions:** the hidden holds add to a stop (holdWorld shifts every world clock), so heldWorldMs subtracts them on
top of worldMs rather than as scale-0 stops; the screen reads the detail's own roster (no export fetched) and counts
an account among cached development details only; identity hashes parts of the replay record rather than the
snapshot entry (that is measure's), so a difference names where to look.

**Problems:** a code edit during the first snapshots:update would have failed it (codeKey); stopped and rerun after
the commit. The `--fetch` path is untested against the site (no downloads this round).
