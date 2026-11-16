## 2026-10-18: batch 1 — values, skills, arts, physical state, time

**Goal:** the rest of batch 1's shared features, per family.

**Done:** values and resources (event counts, starting stacks, SP on hits,
energy-grant options, team energy at its data frame); skills (hitless
skills via delayed cast triggers, availability Predicates, cooldown groups,
control-taking casts, follow-up casts, energy-blocking buffs); when the
next action may start, from SkillData windows, `skillSpecification`
priorities and exclusive time, with interrupts cancelling hits still to
land and basic-attack chain steps from the data; stack requirements as
ranges with partial use; arts-state extensions (enemy-element infliction,
partial absorption, burst events, applier status tweaks, status
consumption); the log checker's skill-set stack caps; physical state
(Vulnerable, Lift, Knock Down, Crush, Breach, Shatter) and stagger with
finishers; control statuses that freeze the enemy's clock; ultimate time
stops and global slow-downs; haste.

**Decisions and why:**
- Research by sub-agents on Endaxis (read, not copied) for the skill-gate,
  time and physical rules; claims checked against our data and logs
  before use. Endaxis's "no windows, anything goes" is its own admitted
  bypass, so the engine doesn't follow it; its ignoring of
  `cantSwitchPosition` isn't followed either (the data is explicit).
- A recorded action without a time waits for the current skill's own
  hits; only an explicit time interrupts. Otherwise every priority
  interrupt would cut skills short in hand-written rotations.
- Slow-downs shift everything after their start by the frames they cost:
  exact for stops, simple, and keeps state plain.
- Haste and the time stop's effect on cooldowns are assumptions with
  in-game tests (18, 19); 15–17 check the skill gate.

**Problems:** the Laevatain example overran Twilight once enhanced attacks
waited for the data's exclusive time, until her kit got the Twilight
pause (report gap 2); Liino's example had a chain step the chain no longer
allows. One commit went out with a type error in a test (fixed in the
next).

**Results:** example totals moved only where timing changed (−1.6% to
+2.9%); log checks gained Estella's and Gilberta's physical-status hits
(coverage 52% → 83% and 67% → 79%) with no mismatches.

**Next:** merge the SkillData compiler (D1, in progress in a worktree),
use it for loader defaults, re-analyse the seven, write the kits.
