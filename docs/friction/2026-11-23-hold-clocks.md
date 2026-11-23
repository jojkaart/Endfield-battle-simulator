# Hold clocks: enemy statuses and Corrosion's ramp (2026-11-23)

Task: add the enemy's listed statuses and Corrosion's ramp steps as clocks of the hidden holds (packages/logs holds.ts),
look into Rossi's Wolven Blood clock, the last merge's combination regressions and d774's Sunderblade count. Branch:
the worktree's own (agent-a282e…), on main at 235d717.

## 1. Two sets of "the placed stops" that disagree

- **What happened:** my first Corrosion-ramp bounds used `worldMs(since, t, castTimeStops(data, placement.casts))`, as
  holds.ts `tickBounds` and buffreplay.ts `runBounds` do. In db87 they asked 1.8 s of hidden hold where the replay
  needed 0.3–0.9 s: the replay places Laevatain's ultimate at 16.60 s from its cast event and holds the world 1.5 s
  there, but `castTimeStops` doesn't have that stop, so the bound counted it as a hidden hold and the replay then held
  the ramp twice. Found only by reading `zmdlogs ramp` output by hand (about an hour, with a measure run). Likewise
  4d60's Zhuang Fangyi ultimate at 73.63 s (2.6 s) is in the replay but not in `zmdlogs worldtime`. 489c's Wolven Blood
  bound "asks 3.05 s" for the same reason (a stop the placement has and the replay's instance doesn't see).
- **Cause:** the replay's stops come from the engine's casts (slowDown on every cast the replay makes, ultimates placed
  from events included); the views and the bound builders recompute stops from the placement (logcasts.ts
  castTimeStops), which misses casts placed from events only. The open-problems db87 entry already named this as a
  "tool gap"; nothing enforces one source.
- **Suggestion:** export the replay's own stops from replayKitBuffs (`BuffReplay.stops`: each slow-down the timeline
  made, from `TimelineState.slowdowns` as they are added) and use them in runBounds, statusBounds, tickBounds,
  `zmdlogs worldtime` / `lanes --world` / `holds`; keep castTimeStops for the placement itself. A test: every placed
  ultimate's stop appears in both.
- **Why it helps:** every clock bound and every world-time view would measure against what the replay actually holds;
  the double-counting class of bug goes away. Cost: the views need a replay (they mostly run one anyway).

## 2. `measure --hits` compares against the snapshot commit's code, which can be your own HEAD

- **What happened:** after committing a WIP (code only, snapshots unchanged), `npm run measure -- --hits` reported "no
  hit's verdict changed" for every moved log: the per-hit reference ran the snapshot commit's code, which was my HEAD
  (the same code as measured). I had to rerun with `--base 235d717` (another minute plus the queue).
- **Cause:** the scoreboard's reference is the committed snapshots, but the per-hit reference is "the code at the
  snapshots' commit"; after a code-only commit those are different things, and the output doesn't say so.
- **Suggestion:** in scripts/measure.ts, when the snapshot commit's code differs from the code that wrote the snapshots
  (any non-snapshot file changed since the last commit touching tests/snapshots/), use that last snapshot-writing
  commit for `--hits`, or print a warning "the per-hit reference is your own code: use --base <ref>".
- **Why it helps:** one measure run instead of two, and no misleading "no hit changed".

## 3. The engine shifts timers at a stop's start, so values read inside a stop are wrong

- **What happened:** 4d60's ramp readings had the replay's Corrosion step jump back 3 steps at 73.65 s. Tracing it took
  three scratch scripts (status appliedAt per hit, the replay's status events, `replayKitBuffs({ trace })` over every
  kit buff to find the step that shifted everything): Zhuang Fangyi's ultimate stop, modelled as "shift everything
  after the stop's start by its length" (clock.ts slowDown / shiftWorld). That is exact for ends, but a value derived
  from `appliedAt` (Corrosion's ramp) read inside the stop is set back by the rest of the stop. Fixed for Corrosion
  (`rampHeld`), but anything else that reads elapsed time from an anchor inside a stop has the same trap.
- **Cause:** the representation is documented at slowDown ("exact for a stop, and for a partial slow-down after it
  ends") but not where statuses or buffs are read; there is no trace of the enemy's statuses (BuffReplay.traces covers
  kit buffs only).
- **Suggestion:** (a) extend `ReplayOptions.trace` to enemy statuses (`status:corrosion`), so `zmdlogs replay
  --trace-buff status:corrosion` shows each step that moved it; (b) grep the engine for other `frame - x.appliedAt`
  readings (buff layers' ramps, ticking buffs' counters) and route them through one helper like `rampElapsed`.
- **Why it helps:** the jump would have shown in one command; the next anchor-based value won't repeat the bug.

## 4. A cited probe script lives only in a worktree's scratch/

- **What happened:** the corrosion-lag reading the smaller-leads round cited ("scratch/corrosion-lag.ts in the
  session's worktree") was found by listing all 30 worktrees' scratch folders. I turned it into a view (`zmdlogs ramp`),
  but my own cross-log probe (scratch/rampprobe.ts) is again only cited by worktree path.
- **Cause / suggestion:** as the hidden-holds report said: a `scripts/probes/` folder (not linted, not tested) with a
  one-line index, for scripts whose numbers docs/open-problems.md cites.
- **Why it helps:** the next round reproduces a number in a minute instead of hunting for it.

## What worked well

- `npm run measure -- --base <ref> --hits` with the changed hits per log made each regression (af7b, 9847, 4d60)
  traceable to a time window in minutes.
- `zmdlogs holds --verbose` printing each bound with what was placed made the 9847 conflict (ramp against Gilberta's
  Vulnerable) obvious.
- `scripts/at-commit.ts` gave a base-code worktree to run the same scratch script on both codes.
