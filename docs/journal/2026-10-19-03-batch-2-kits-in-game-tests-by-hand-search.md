## 2026-10-19: batch 2 — kits, in-game tests by hand, search

**Goal:** batch 2's kits; make the in-game tests doable by hand (owner:
frame timings and exact SP can't be tested; the game shows an SP bar).

**Done:** five kit agents in worktrees (each re-checked its report's gaps
against the new engine first, then wrote the kit and its equipment) and one
agent reworking docs/in-game-tests.md; merged one at a time with the full
check, example totals and log verdicts after each (all unchanged; the
compiler test's OPERATORS/KNOWN lists conflicted at every merge, resolved by
keeping both). Fluorite's 56 logged hits match after fixing her fixture's
build from the log. At the merge: attributes 62/63 on kit buffs, the gate
looking again after a counter's jump. Pattern review done
(kit-abstractions.md). Search: optional resource weight (+4.6% on
si-laevatain at weight 1, no change for Laevatain alone), and found
rotations are now applied during the search exactly as recorded.

**Decisions and why:**
- In-game tests must be observable by eye or by a stopwatch (≥ ~2 s),
  with a relative comparison and predictions per hypothesis; otherwise
  "not testable by hand" with the impact noted (the doc's intro).
- Search applies each step with its `at`: a found rotation once failed to
  replay (Liino + Laevatain: a swap legal at 138 in the search, at 198 on
  replay); applying as recorded makes replay equal by construction.

**Problems:** a search over a 49 s two-operator fight (typhoeus-gilberta)
took over 10 minutes at beam 24: search speed for long team fights is
next to fix. One kit agent couldn't run `source scripts/setup-worktree.sh`
(tool refusal) and made the links by hand.
