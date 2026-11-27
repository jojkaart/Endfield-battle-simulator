# Camille's Vesperwings and Pogranichnik's harasses (2026-11-27)

Task: e989's Camille Firefang Weakness kept on 69.19–89.32 s by the replay alone, and Pogranichnik's harasses 0.2–2 s
off (docs/open-problems.md); worktree branch off main at e2e6f3f.

## 1. No view of a trigger's follow-up hits against the events that make them

- **What happened:** the harass question is "how long after its physical status or combo slash does each harass
  land, in the log and in the replay". No view says it: I wrote two scratch scripts (now
  scripts/probes/entities/harass-deltas.ts, which greps `zmdlogs replay` output with a regular expression for its LAND,
  NOLAND and "replay only" lines, and a second that prints each logged harass with the statuses before it). Trying a
  kit frame meant a kit variant (`--kit`) and a rerun of the grep over five logs, about a minute each; the pairing's
  16-frame window turned a constant lag into "replay-only / log-only" pairs I had to read by eye.
- **Cause:** `zmdlogs casts` and `replay` are per cast or per landing; a trigger's hits (KitTrigger `hits` actions)
  have no cast, and nothing groups them by the trigger that fired them with the trigger's event.
- **Suggestion:** `efsim zmdlogs followups --operator <op> [--trigger <id>] [--all]`: each landing a kit trigger made,
  with the event that fired it (its frame and kind), the logged hit it was paired with and the delta, the unpaired
  ones on both sides with the nearest of the other side, and a per-trigger summary (median |Δ|, one-sided count); it
  takes `--kit` and `--assume` like every replaying view, so a variant's effect is one command.
- **Files:** packages/logs/src/views.ts (a new view beside the replay's), packages/cli/src/commands/zmdlogs.ts,
  docs/design/data.md's question table.
- **Why it helps:** every entity follow-up (Pogranichnik's Shieldguards, Camille's explosion, Typhoeus's bursts, Arcane's
  lasers) is diagnosed by this question; the probe's regex breaks with the replay's line format.

## 2. A replay-only rule needs an engine assumption, and the registry sits in another agent's folder

- **What happened:** the Vesperwings rule is read only by the log check's replay (like `logged-purges`), so it belongs
  in ENGINE_ASSUMPTIONS, but that is packages/engine/src/timeline/assumptions.ts, the parallel agent's folder. I made
  it a kit assumption instead (Camille's `vesperwings-target-loss`, named from a new KitBuff.targetCheck field), which
  needed a field to name the assumption and a loader check that it has the readings the replay knows.
- **Cause:** the registry of engine assumptions is one file inside timeline/, which most rounds split off as one
  agent's; kit assumptions only select triggers (KitTrigger.reading), not buffs or replay rules.
- **Suggestion:** move ENGINE_ASSUMPTIONS to packages/engine/src/assumptions.ts (outside timeline/, a module split by
  scripts/split-module.ts), with entries replay-only rules can add without touching timing code; or let kit
  assumptions name any kit item's reading (a buff's field as well as a trigger) so a kit-scoped rule doesn't need a
  pointer field.
- **Files:** packages/engine/src/timeline/assumptions.ts, packages/engine/src/model.ts, packages/data/src/kits.ts.
- **Why it helps:** lead briefs split by folder; a registry entry is a line, not a held-back diff.

## 3. BuffReplay.instances answers null for a buff the replay doesn't decide, without saying so

- **What happened:** my first test read `r.instances(hit, "buff_chr_0033_camille_normal_skill_weak")` and got null at
  every hit; it took reading buffreplay.ts to see that it answers only for decided game buffs (the Vesperwings' are
  not decided in e989) and to switch to `kitWindows`.
- **Cause:** the null means both "near a change" and "not decided"; the interface's comment says the first only.
- **Suggestion:** return `{ undecided: reason }` (from BuffReplay.undecided) instead of null for an undecided buff, or
  say both in the doc comment and point at kitWindows for kit-buff windows.
- **Files:** packages/logs/src/buffreplay.ts (BuffReplay.instances), its callers in logcheck.ts.
- **Why it helps:** a test or probe writer learns in one run why there is no answer.

## 4. `--against-lanes` compares the runs' starts only

- **What happened:** `zmdlogs replay e989 --kit-buff chr_0033_camille:vesperwings --against-lanes` paired the log's
  runs with the replay's windows by start; the question was where each ends. I read the ends from the BUFF lines and
  `zmdlogs ends --at`, one moment at a time, and wrote a scratch script for every Camille log's runs.
- **Cause:** the view was built for start leads (refreshes, late applications).
- **Suggestion:** add each pair's ends (the log's last listing and next unlisted moment, the replay's window end and
  why it ended: expiry, refresh, purge, target loss, hold) and flag a pair whose ends differ by more than a moment.
- **Files:** packages/logs/src/views.ts (the against-lanes table), packages/logs/src/endsview.ts.
- **Why it helps:** "the replay keeps a buff the log ended" is the most common kit-buff lead; one command lists them.

## 5. Ability-entity files are missing from the data, and the tree says only "no file"

- **What happened:** `efsim gamedata tree abilityentity_chr_0033_camille_normal_skill` (the Vesperwings entity) failed;
  the entity is spawned by SpawnAbilityEntity with an abilityEntitySkillId and its buffs, and its own definition (life,
  duration, passives) isn't in the export. I found its behaviour from the skill and buff files the spawn names.
- **Cause:** the export has SkillData and BuffData only; the message doesn't say what to read instead.
- **Suggestion:** for an `abilityentity_*` id, `gamedata tree` (and `who`) prints the SpawnAbilityEntity actions that
  spawn it, their abilityEntitySkillId and assigned blackboard, and the passives and buffs that name it, saying the
  entity's own file isn't in the data.
- **Files:** packages/cli/src/commands/gamedata.ts.
- **Why it helps:** every entity question starts there (Camille, Pogranichnik, Arcane, Zhuang Fangyi).

## What worked well

- `npm run measure -- --variant <assumption>=<reading>` measured both new readings and their own effect in one run.
- `zmdlogs ends --at` and `zmdlogs away` answered "what ends here, what goes on" and "which stretches" at once.
- `--kit <file>` let me try harass frames and clocks without touching the kit.
- `gamedata tree` printed the inline Unity curve keys, enough to integrate the slow-down exactly.
