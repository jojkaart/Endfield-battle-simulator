# The cooldown-clock round: trigger clocks, travelling landings, Arcane's bursts, Ember's finisher (2026-11-24)

Task: four accuracy leads from the kit-buff and placement rounds (a per-trigger cooldown clock, a kit field for
travelling landings, Arcane's bursts in the replay, Ember's finisher in 7e19): find each root cause and fix it or rule
it out. Branch worktree-agent-a8e6bc8bf04904f0e, base e3272c6.

## 1. Measures in a queue are each relative to the committed snapshots, so interacting changes hide

- **What happened:** I measured the burst-clock reading, then three placement variants (the travelling-landing
  field) and two bisection patches, all queued at once, each against the snapshots committed at the base. The
  placement variant I adopted (T2: only travelling landings from their events) measured +1 plain and nothing worse;
  combined with the burst-clock default I had committed meanwhile, the final `snapshots:update` showed the verified
  b7b3 mixed (plain 47 → 45): Tangtang's stare needs the event so that Arcane's burst, now held by her own stop, lands
  as logged. I found it only from the scoreboard's direction line, then `cli-ab` on b7b3; one more full snapshots run.
- **Cause:** each queued measure fixes the code at queue time, which is right, but nothing says that two of the
  candidate changes in the queue touch the same logs. The variants' "better" lists are against the base, not against
  each other.
- **Suggestion:** a `measure --after <patch|ref>` (or `--variant` stacking with `--patch`) that measures a patch on top
  of another candidate, and in the summary of a queued measure a line "logs this one moved that a measure queued
  before it also moved" (both summaries are in scratch/measure/).
- **Why it helps:** the interaction shows before the final snapshots, not after; costs one extra measure.

## 2. No way to see which operators a moved hold-out has, so attributing it costs patch-per-trigger measures

- **What happened:** the trigger-cooldowns change moved two hold-outs' totals worse ("totals damage ×2, operator keys
  2"). To explain it I wrote two throwaway patches (only Swordmancer on the world's clock; only Laevatain's absorb) and
  measured each (two queued runs, ~10 min) to see which trigger moved them. The hold-out kind table (replay-only 4.9 →
  4.8%, log-only unchanged) then gave the explanation.
- **Cause:** by design the hold-outs' operators are hidden, so a change touching many kits can't be attributed to a
  kit without bisecting by hand.
- **Suggestion:** `measure --split` (round 11 added `files|commits`) with a `triggers` or `kits` mode for a change to
  the engine's per-trigger behaviour: one run per kit (or trigger id) of the change, aggregates only. Or an
  environment hook the measure sets per run, e.g. `EFSIM_ONLY_KIT=<id>`, that a change can read for a split.
- **Why it helps:** the explanation the brief asks for ("two hold-outs worse: explain") in one command; no secrets
  leak (counts per kit, as now per direction).

## 3. A trigger's game-data mechanism isn't shown anywhere, so the first hour was finding it

- **What happened:** to derive the clock from the data I had to find, per kit trigger, which BuffData / SkillData
  mechanism backs its cooldown (AddGlobalCDTimer, CreateTimedMarker, a `_cd` buff, a buff's addingCooldown). Kit
  notes cite some of them in prose, not all; I wrote three scratch Python walkers over the data and one over the kits.
  The compiler now does it (skillData.ts cooldownTimers), but `efsim kit` doesn't print it.
- **Cause:** kit triggers are hand-written; the data facts behind them live only in notes.
- **Suggestion:** `efsim kit <id>` prints, per trigger with a cooldown, the mechanism the compiler found
  (cooldownTimers' kind and key) and the resulting clock; `efsim kit-census` counts them. (packages/cli is the tools
  agent's; a line in cli/src/commands/kit.ts.)
- **Why it helps:** the next clock question (addingCooldown's, a marker's) starts from a table, not from greps.

## 4. Bash-guard refusals for one-off inspections

- **What happened:** two refusals: a multi-line `python3 -c` and a two-paragraph `git commit -m`. Both have a safe form
  (scratch file, `-F scratch/msg.txt`) that I knew; the guard caught them as intended.
- **Cause:** habit; the rule is documented.
- **Suggestion:** none beyond the guard's message, which named the safe form each time.
- **Why it helps:** n/a (worked as designed; listed so the round can count it).

## What worked well

- `measure --variant` for engine readings: three readings of `burst-stops` and two of `finisher-stagger` in two runs,
  with per-hit changes (`--hits`) naming the hit and the modifier that moved.
- `cli-ab <ref> -- zmdlogs hits <ids>`: found b7b3's three moved hits in one call and confirmed the final placement
  rule identical to the old one on four logs.
- `zmdlogs casts` / `replay --from --to` made each Arcane burst case readable in a minute; round 11's new
  `zmdlogs bursts` gave 9a80's world time between cause and burst directly.
- `scripts/edit.ts` for the doc batches: no shell quoting of backticks.
