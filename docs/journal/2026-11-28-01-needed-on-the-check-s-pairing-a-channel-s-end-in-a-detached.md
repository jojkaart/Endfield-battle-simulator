## 2026-11-28: needed on the check's pairing, a channel's end in a detached file

Goal: two entries of the accuracy list in docs/friction/2026-11-27-backlog-after-round-21.md: cutTails' `needed` on
the replay's own pairing, and a capped channel inside a detached file (both left by round 21 as moving verdicts).

Done (9da9d4a, 592f7c7):
- **`needed` on the check's pairing** (replayrun.ts loggedShown, cutTails): a kit hit's landing is now
  landingpairs.ts pairKitLandings' (pinned, else a landing of its operator with its event within 16 frames, each once);
  the statuses' half stays loggedShown's own. Alone that kept tails it shouldn't: a logged hit before the cut that the
  pairing had given one of the tail's unlogged landings counted as lost (c83c 47.17 s: eight batched Arcane attack-4
  hits, four the placement's twins, paired with the 47.23 s cast's landings at 47.50 / 47.60 s; 4a64 16.93 s, 9847
  44.53 s): hold-out |damage error| 5.9 → 6.8%, 4a64 +2 plain. So only a logged hit after the cut counts: the tail's
  landings and what they set off come after it. With both, and with the filter alone on the old rule, no log's
  verdicts or totals move. abfd's 64.10 s case is gone since round 21's channel end.
- **A channel in a detached file gets its end** (skillCompile.ts drops `!detached`): Tangtang's ultimate stare to
  frame 196 (b7b3 and 7910 have no tick past it once the stops between are out: b7b3's 15.28 s tick sits after Last
  Rite's 12.30–15.13 s ultimate stop), Rossi's wolves, Zhuang Fangyi's attack-5 and ultimate attack-3 ranges (single
  landings: nothing reads their end). Typhoeus's Barrage Array (frame 215) is marked in her kit, `dataOverride`
  `latest`, now a DataField (kitMatch.ts compares the kit hit's latestFrame with the data, schema enum too): the logs
  have its 18 ticks up to 6.4–8.0 s of world time after the first with no combo press between, and the end split one
  array into two combos six times (00ae, fc63; unmarked: 00ae 1.1 → 3.9%, fc63 3.2 → 5.9%, hold-out plain −6,
  docs/tried/2026-11-28-barrage-array-channel-end.diff). With the mark nothing moves.

Checks: measure against 60fa436 for each change (no verdict or total moved anywhere: development plain 84.3%,
|damage error| 1.3%; hold-out 82.5%, 5.9%; earlier pending and several targets unchanged); `npm run smoke` passed;
team-ab identical for both teams (the owner's and Typhoeus's: every hit and a rules seed the same, the 32-seed
numbers unchanged); snapshots:update for the kit digests (Tangtang, Rossi, Zhuang Fangyi).

Decisions: the channel's end per kit hit, not per file kind: the data's end where the logs agree, a reasoned mark where
they don't, as any other data field. The after-cut filter is not a fit: a hit logged before the cut can't be what a
later landing set off.

Still open: what runs Typhoeus's array past its entity's 180 frames (its entity held by stops the placement's world
time leaves in, or a longer life; its first tick also 0.5–0.7 s after the press against the kit's 1.17 s).
