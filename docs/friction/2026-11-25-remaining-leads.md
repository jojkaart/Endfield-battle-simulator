# The remaining leads: Empyrean end, ultimates in turn, the touch element (2026-11-25)

Task: the six leads left by the 2026-11-24 rounds (Zhuang Fangyi's Empyrean end, Typhoeus's fc63 infliction state,
Arcane's last bursts, travelling ability entities, 7e19's ×1.096 and d4fb's Swordmancer exception, the marker
clocks); root cause and fix or rule out each. Branch: the worktree agent-a14805062f9961344, base eec0473.

## 1. The hidden-hold placement reshuffles a whole fight when one stop moves

- **What happened:** moving Gilberta's ultimate in 489c 1.9 s earlier (into the 1.84 s stretch where the log has no
  hit and Arcane's attack 4 is split in two: clearly a stop) made 489c lose 103 plain hits, at 46–63 s, 20–40 s away
  from the move. `zmdlogs holds` A/B (cli-ab) showed the placed hold units moved from 37.73 / 50.75 s to 74.17 /
  77.20 s and the Corrosion-ramp bounds were now "dropped as conflicting"; the verdicts that fell were Corrosion
  readings ("within its range but at no level that fits": Si 13 → 44, Arcane 21 → 61). Working out why took four
  measures and I still can't say which bound flipped the solution.
- **Cause:** holds.ts placeHolds solves one least-total problem over every clock of the fight; a stop's move changes
  the world time inside every bound that spans it, and the conflict resolution (drop the bound asking most) can flip
  to a different set. Nothing reports which bounds a change made conflict or why a unit moved.
- **Suggestion:** `zmdlogs holds --why-moved <ref>` (or cli-ab `--holds` extended): for each unit that moved or
  vanished, the bounds that pinned it before and after, and the bound newly dropped with the one it conflicts with.
  Longer term: place holds per stretch between stops that every clock agrees on, so a local change stays local.
- **Why it helps:** every placement fix (several per round) is measured through the holds; a placement that is
  right by the log's own evidence shouldn't read as −100 plain without saying which clock broke.

## 2. Placement changes inside placeWith cascade through the second pass

- **What happened:** the in-turn rule first ran inside placeWith, against the first pass's stops. In 4360 it moved
  Gilberta's ultimate against a Liino stop that the second pass then placed elsewhere (from her event), leaving the
  two overlapping; in 9c6e it moved Arcane's 4.3 s and that moved Liino's. Moving it to a pass after the placement
  (logcasts.ts inTurn) fixed both, but each wrong version cost a 75 s measure to see.
- **Cause:** placeHits is two passes where the second reads the first's stops; a rule that reads other casts'
  stops sees a list that is about to change. Nothing says which rules depend on the stops list or that the result
  isn't a fixed point.
- **Suggestion:** a note at placeHits (and docs/design/data.md's placement paragraph): rules that compare a cast's
  stop with another cast's belong in a pass over the settled placement; and a cheap check in the pending suite that
  no two ultimates' stops overlap by more than a few frames unless both are anchored to cast events (the
  scripts/probes/placement/ult-overlap.ts list, which still has 15 pairs).
- **Why it helps:** the overlap list is now a measurable property; the next agent can see which pairs remain and
  why (most are three-stop chains or event-anchored pairs).

## 3. The enemy's infliction state isn't visible in the replay views

- **What happened:** fc63's lead was "the infliction state before Arcane's ultimate is wrong". `zmdlogs reactions`
  shows bursts and consumptions, not inflictions; ReplayRecord's status traces covered statuses but not the Arts
  infliction, so I wrote a scratch script over `replay.reactions` (no `inflicted` events there either) before adding
  `status:infliction` to replayrecord.ts enemyStatuses. Only then did the trace show the touch at 81.47 s applying
  Pulse, the actual cause.
- **Cause:** the infliction is the one enemy state the views never printed.
- **Suggestion:** done here (`--trace-buff status:infliction`); also list `inflicted` events in `zmdlogs reactions`
  as "other" lines, and let `zmdlogs bursts` print the replay's infliction stacks and appliers just before each
  burst.
- **Why it helps:** every burst or reaction lead starts with "what did the enemy have"; it is one flag now.

## 4. The boundary of "on at a frame" is easy to get wrong between the engine and the replay

- **What happened:** 4bfc's 179.51 s lead looked like a clock problem (the brief's framing and the open-problems
  note: "its Empyrean ends early"). It was the buff ending on the event's own frame: the advance to the frame ticks
  and ends it, then loggedTick looks for it and finds nothing. Finding that took instrumenting loggedTick and
  heldTicks with stderr prints, because the views show the window's end to 0.01 s and the event to 0.01 s, the same
  number.
- **Cause:** activeAt is half-open ([appliedAt, expiresAt)), heldTicks moves a tick *to* the event frame, and
  makeCast advances before reading; no view says "ended at this very frame".
- **Suggestion:** the replay's EVENT line for a ticksLoggedAs key could print the buff's expiry and next tick in
  frames when it makes the cast ("the buff wasn't on: ended at frame 5385, the event's frame"), so an off-by-one is
  visible without instrumenting.
- **Why it helps:** a whole lead was one frame; the next such one costs a minute instead of an hour.

## 5. Ability entities: the data that would decide "travels" isn't in the sources

- **What happened:** lead 4 asked for KitHit.travels on Tangtang's stare and Arclight's dash "if the data shows it".
  The SkillData of both entities has no movement action, and the AbilityEntity definitions (where a move or speed
  would be) aren't in either data source; I grepped the main checkout's data to be sure.
- **Cause:** data/README.md doesn't say which game tables are absent.
- **Suggestion:** a line in data/README.md: "not in the sources: AbilityEntity definitions (movement, lifetime)",
  so the next brief doesn't ask for them.
- **Why it helps:** saves a search and a brief's lead.

## What worked well

- `npm run measure -- --patch` for variants that aren't assumptions yet (the touch element, the travelling
  entities): one command, the same summary, nothing to revert.
- `zmdlogs worldtime`, `zmdlogs casts`, cli-ab on `casts` / `holds` / `check`: the in-turn evidence (quiet
  stretches the length of a stop) came straight out of them.
- The runstate script after the container restart: what had finished and at which code, in one line.
