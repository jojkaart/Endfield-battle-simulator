# Alesh's Rare Fin: chance paths and a cast from the listing (2026-11-26)

Task: build a general rule for casts and paths the log shows only through their listed buffs (0c14's eventless
Alesh combo, her Rare Fin paths in 0c14, 4e36, a9d7), check it across the development logs and measure; branch of
the worktree agent-a767e0777534906f8 from main 4569c99.

## 1. A measure against snapshots another commit's code wrote

- **What happened:** the first `npm run measure -- --variant listed-casts=none` compared against the snapshots at
  HEAD, which d76b58c's code had written with 51 code files changed since; its "development" and "hold-out" rows
  mixed main's own unmeasured changes with mine. The first line says so, but the summary below it reads like this
  tree's change. A second measure with `--base 4569c99` (four more minutes with the queue) gave the change alone.
- **Cause:** measure's default reference is the committed snapshots, which on main are routinely stale (merges
  without `snapshots:update` per merge); the warning is a line among a dozen of queue messages.
- **Suggestion:** when the snapshots aren't the code's own, measure defaults to `--base <the merge base with main>`
  (or refuses without `--against HEAD`), and prints the reference's kind in the summary's own heading ("against
  4569c99's code" / "against snapshots of d76b58c").
- **Files:** scripts/measure.ts.
- **Why it helps:** the first measure of every task is the one that decides the next step; a stale reference wastes
  it. Cost: a base run doubles a default measure's CPU.

## 2. Two paths' hits paired by their keys alone

- **What happened:** listedPaths paired Alesh's slam_ex with the normal path's hook (all four combo hits log one key,
  chr_0024_deepfin_combo_skill), so the 59.56 s combo got no decision and still rolled; the engine's new
  chancePathLandings had copied controlPathLandings' pairing (`events` equal, the first target found) with the same
  flaw. Found by a scratch print, one debugging round.
- **Cause:** "the same hit on the other path" is computed in three places (controlPathLandings, chancePathLandings,
  chancePathHits) by hand; the keys don't identify a hit when one key covers a whole skill.
- **Suggestion:** one engine helper `pathTwin(skill, hit, jump)` (same keys and frames shifted by the jump's length,
  else none) that the three call; controlPathLandings would then also stop pairing by the first key match.
- **Files:** packages/engine/src/timeline/drivers.ts, packages/logs/src/castassembly.ts.
- **Why it helps:** the next jump-path rule (Rossi's, Pogranichnik's) gets the pairing right by construction.

## 3. A buff's decidability is computed before the casts exist

- **What happened:** P3 was "undecided" for every log (replaycrits.ts chancePathBuff: a chance path's buff), but
  whether the replay decides it now depends on whether every cast's path came from the listing, which is known only
  after assembleCasts; buffreplay.ts computed the decided / unjudged sets before assembling, so I moved
  assembleCasts up and threaded a set through undecidedBuff's recursion.
- **Cause:** undecidedBuff is a function of the kit alone, while some reasons (chance paths, the log recording an
  operator's buffs at all) depend on the log and the replay's casts.
- **Suggestion:** one `buffDecidability(kits, fx, casts)` in replaycrits.ts returning, per kit buff, decided or the
  reason, called once after assembleCasts; buffreplay's two loops read it.
- **Files:** packages/logs/src/replaycrits.ts, packages/logs/src/buffreplay.ts.
- **Why it helps:** the next per-log reason is one branch there, not another parameter on a recursive function.

## 4. The worktree guard refusing a plain sed with an inserted line

- **What happened:** `sed -i '288a\ …'` with an embedded `\n` (no git, no cd) was refused as "too complex to verify
  that it stays inside the worktree"; Edit did it.
- **Cause:** the guard's worktree check treats unusual quoting as unverifiable.
- **Suggestion:** say in the refusal that the Edit tool is the way for a multi-line insertion.
- **Files:** scripts/bash-guard.ts.
- **Why it helps:** one wasted call less; minor.

## What worked well

- `zmdlogs decisions --all --assume listed-casts=none` showed in two minutes that the new cast rule fires once in 61
  logs, before any measure; adding a PATH kind to it made every path decision checkable the same way.
- `node scripts/cli-ab.ts 4569c99 -- zmdlogs totals <fixture>` explained a9d7's slightly further total (the replay-only
  Rare Fin landings gone, 56k → 16k) in one command.
- The probes' scratch template and `devFixtures({ ids })` made one-off checks of the listing a few lines each.
