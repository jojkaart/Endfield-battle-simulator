## 2026-11-23: Arcane's reset reaches a combo inside her first 9 frames; Purrchena's stops; pinned expiries

**Goal:** round 8's accuracy list: the combo reset's reach (the engine against the log tools' stop lists), Purrchena's
one-sided stops, pinned expiries re-measured, then 489c's bleed tick series.

**Found and done:**
- **The reset's reach:** a teammate's combo slow-down starting between Arcane's combo and her frame 9 ran whole in the
  engine (24–27 frames) where the lists cut it (2–4). The logs side with the lists: 9555's Imprisonment burst comes
  1.46 s after her cast, as with no teammate's combo (1.48 s at 81.53 s; held, 1.84 s), and the hits after it carry her
  Susceptibility and gear-set bonus as logged (assumed ×1.07–1.41 → plain); 7910 and c83c likewise; 1d91's Liino volleys
  0.5 s late → on time. Engine: TimelineState.resets, a reset still to come cuts a slow-down of its priority that starts
  before it, which doesn't hold the reset's caster (clock.ts slowDown); `combo-reset` default `reaches`.
- **Purrchena's combo:** no hits of its own, so the lists kept all three slow-downs (0, 210, 270) for every cast: now the
  path with no conditional jump when no landing shows one (logcasts.ts pathOf). The engine's 210 path reached the
  frame-270 slow-down past her loop's cast at 250: SkillTiming.recasts (a CastSkill of her own skill on the timeline) end
  a path's slow-downs (pathSlowdowns); her shield extension 41 − 13. The replay's record kept one slow-down per start and
  priority, which hid a jump's own slow-down beside the frame-0 one (Purrchena, Rossi's combo_3, Pogranichnik); now kept
  apart, `replay --stops` calls the covered ones "covered (the same holds)". No length difference left.
- **Pinned expiries:** round 8's diff re-measured on this code: verified, development, earlier pending unchanged, one
  hold-out "other". Adopted (the log's end already holds every stop up to it; simpler than the step-at-a-time keep).
- **489c's bleed series:** not a reapplication (1.00 s ticks either side of the 1.54 s gap; the gap's +0.54 s is what the
  ramp asks too). The hold is dropped because a unit at 49.4–53.0 s and it exceed the ramp's cap from 49.31 s; its first
  tick, inside Rossi's combo_3, asks −0.19 s (her combo_3 over-hold again). Dropping tick anchors inside slow-downs
  measured worse (489c 590 → 580 plain): not adopted.

**Scoreboard** (`npm run snapshots:update`): development plain 65.7 → 65.8%, matched 80.4%, mismatch 14.8%, mean
|damage error| 8.6 → 8.7%; hold-out 77.4 → 77.3%, 91.9 → 91.8%, 6.3%, 10.2% (1 better, 1 worse, 1 other); earlier pending
58.5 → 58.6%, 17.8%, 8.1%; verified unchanged. Better: 7910 (324 → 339), 1d91 (336 → 341), c83c (563 → 569), 489c, db87;
9555 mixed (261 → 270 plain, per hit closer). Worse: 8915 −6 plain (hidden holds placed again: a unit at 90–95 s holds an
unlisted Corrosion, ×1.015), fc63 +2 mismatch (her Susceptibility now on two hits the log reads without it, among
replay-only Typhoeus combo landings), 6339 damage 35.7 → 37.5% (a lost landing in a log a third off).

**Teams** (team-ab against 6ddacfa): Typhoeus's team unchanged; Estella's at zero energy +0.08% sustained (+0.64% as a
bot, −0.32% at 0.6 s), full energy −0.05%, both 60 s timelines unchanged: within the seed spread.

**Problems:** finding every case took a scratch loop over 80 fixtures (no multi-log `--stops`); a kit number written as
"the data's length minus the engine's hold" had to follow the engine fix by hand (friction report).
