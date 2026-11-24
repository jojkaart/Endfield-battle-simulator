## 2026-11-24: Improvement round 11: measure --split, zmdlogs bursts, the views' stops without the replay's ticks

**Goal:** the owner's friction workflow, round 11: the five open reports (round 10's backlog and own report, the
misprediction candidates, the kit buff leads, the placement leads), tools only, beside an accuracy agent in the kit
compiler, kits, engine, placement, replay and check core; no verdict may move.

**Done** (docs/friction-done/2026-11-24-round-11.md has the list by cause; the backlog,
docs/friction/2026-11-24-backlog-after-round-11.md, the rest):
- `npm run measure -- --split files [--group a,b]` / `--split commits --base <ref>`: each part of a change measured on
  the logs the whole moved; the summary's reference line; `--variant` also against the plain tree. On the placement
  leads' range: 1cd1 and af7b by 00876b1, 4d60 by the merge that brought the Empyrean's end in.
- `efsim zmdlogs bursts` (each Arts Burst logged against replayed, each side's likely cause, the stops between).
- query.ts castEventPlace in `instances` and `replay`'s EVENT lines (at its press, at its stop's end, …; the log time
  beside the world time); docs/design/data.md's paragraph.
- replayTimeStops `tickRead`: with the replay, the views leave out a hitless event the replay read as a buff's tick,
  as the hold placement does (`zmdlogs stops --all --differ` list only 2 → 0, nothing else moved); the EVENT line
  says when the replay made a cast its key reads as a tick (3aa6).
- The likely-loggedAs screen (loggedas.ts: `zmdlogs differences`, the pending suite); HitRecord.counterfactuals (build.ts
  calls it); analyze.py in numpy (6+ min → 67 s), its buffs section's top-fight and top-hit shares, equipment names,
  NOT_KIT fights, `analyze.py buff`.
- `friction.ts outcomes --backlog`, edit.ts's marker messages, CLAUDE.md and docs/design/tests.md notes.

**Scoreboard:** unchanged (`npm run snapshots:update`: "No log's verdicts moved"); no engine or kit change, so no
team-ab.

**Decisions:** the views' tick filter takes the replay's applied stops rather than every hitless event of a tick skill:
the first version, without the replay, dropped 3aa6's seven real Zhuang Fangyi ultimates (cli-ab showed eleven new
"timeline only" lines); the exact list from the replay itself is buffreplay.ts's (backlog point 6). The bursts' causes
are a search (the replay records neither inflictions nor a burst's source): said in the view's header, the record in
the backlog (point 13).

**Problems:** the loggedAs screen finds no pair in the development logs now (the candidates' fixes took them), so its
test is on a real listing with a made-up kit modifier; the pending suite guards the rest.
