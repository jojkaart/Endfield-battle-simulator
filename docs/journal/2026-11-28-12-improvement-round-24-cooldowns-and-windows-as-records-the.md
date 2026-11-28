## 2026-11-28: Improvement round 24: cooldowns and windows as records, the facts a moved landing loses, measuring in words

**Goal:** the five open friction reports and round 23's backlog (docs/friction-done/2026-11-28-round-24.md), tools
only: no verdict moves.

**Done** (round summary for the details):
- Cooldowns and windows as records: COOLDOWN decision lines (replayrun.ts cooldownEarly, MadeCast.early), `zmdlogs
  replay <fixture> --windows <operator>` (ReplayOptions.trace `window:<operator>`, windowsview.ts), `efsim kit`'s costs
  per skill. 3f78 19.30 s reads off one view: Arcane's window kept shut by her cooldown at 19.17 s, the press 0.83 s
  early.
- The facts a moved landing loses: LOST lines (lostfacts.ts; `decisions`, `replay`'s header, measure's decision counts).
- What a pass or a clock read: `zmdlogs casts --passes`, `casts --event-lags --against-holds`.
- Words: measure's variant section against the reference (headed, indented, a note where the variant undoes the tree's
  change), lead-status's negations, `holds --why`'s stacking type, `kit-census`'s layered buffs.
- Reach: split-module `--reexport`, `zmdlogs which` over the scripts' --help, `runstate --where`, a measure of at most
  three named logs outside the lock, fixtures/.ignore and tests/snapshots/.ignore.
- Conventions: open-problems' head (the state that differs; a wording test on a live lead says so), placeWith's
  stages written down, lead-files by family, data.md's question rows.
- Paperwork: docs/friction/2026-11-28-backlog-after-round-24.md (points 1–4, two new accuracy entries, round 23's
  point 1 parked), the reports and round 23's backlog in docs/friction-done/ with their outcomes.

**Checked:** `node scripts/identity.ts --base 36d6843` at 0a1efea: the data and every log's replay record the same (0
of 65 development, 0 of 13 hold-outs); no engine or data file changed (no team-ab); snapshots:update and premerge as
the round summary says.

**Decisions:** COOLDOWN and LOST as records of the replay read off its own state (no engine change, no new snapshot
key); LOST lines only with the fixture (as BATCH), so `decisions --assume` and measure see a rule that drops them; the
window view from a trace of the state (comboWindow, comboTrigger, readyAt) rather than an engine statistic, which would
catch the sourceless events the cooldown keeps out too (backlog point 3); the measure "bug" reproduced as wording, not
a wrong comparison.

**Problems:** ripgrep 14.1 with several roots ignored the root .ignore for the later roots in most runs (the hold-out
logs listed by `rg --files tests fixtures`; counted only): fixed with per-directory .ignore files and a test. The
opener-landed-at-press diff no longer applies on HEAD, so the LOST lines weren't run on the report's own episode.
