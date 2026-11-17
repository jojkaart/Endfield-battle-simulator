## 2026-11-17: Haste is movement speed; the owner's team drops Initial Stroke

**Goal:** settle what Si's talent Haste does after the logs found it doesn't
speed up attacks (docs/journal/2026-11-17-01-tests-18-19-101-104-from-the-logs-bosses-freeze-haste-isn-t.md),
and whether the owner's team should still press Initial Stroke.

**Done:**
- The owner (2026-11-17) has never noticed Haste in play and would notice
  faster attacks. The game's own glossary entry for Haste (I18nTextTable_EN,
  the `ba.speedup` term) reads "Temporarily raises the movement speed of a
  target … Effects of the same type can stack until hitting the speed cap";
  Slow is its opposite ("movement speed reduction"). So Haste is movement
  speed, which the simulator doesn't model: settled by the data's text, the
  logs (test 19) and the owner.
- In-game test 109 (does the Haste need Initial Stroke) moved to the bottom
  of the queue: it matters only if Haste shortened cooldowns, which nothing
  suggests.
- The owner's team's rule 9 now presses only Si's battle skill (no Initial
  Stroke). `efsim rules … --compare` against the old list: +1.37% ± 0.58 on
  64 fresh seeds at full energy, +0.66% ± 0.52 from zero (noise), one press
  fewer. On seeds 1001–1032: 53,781 (sd 1,194) / 52,740 (sd 1,539), against
  52,382 / 52,716 with Initial Stroke (docs/teams/estella-si-akekuri-arcane.md).

**Left:** the `hasteFrames` plumbing in the engine is now inert (a cleanup
for a later round). No other rule list in examples/ presses Initial Stroke.
