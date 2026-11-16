## 2026-10-18: batch 1 — pass-2 gaps implemented

**Goal:** implement the gaps the seven pass-2 re-analyses left
([batch-1.md](../kit-batches/batch-1.md#pass-2-remaining-gaps-merged-2026-10-18)).

**Done:** Link for every team; layers per recipient, per-subject
cooldowns, a fight-start event; trigger filters (skills, decorations,
finisher, the causing hit's kind, buff categories, heal kinds,
reaction hits, once per cast); before-damage status triggers; branches
for alternative hits; `scaleValue`, cooldown fractions, values of
unlearned talents as 0, `talentAtLeast`, `{talent, key}`; what ends with
a cast (delayed actions, `endsWithCast` buffs, `cancelHits`,
`endAction`); `cantCastSkill` channels; no dive attacks without jumps;
the time a buff had left and what a recording buff recorded; Fixed DMG
(Si's Artful Intent, unique); control-immune targets; event counts in
the log checker; kit buffs in fixtures and `calc --buff`. In-game tests
20–50 collected from the reports. Then a pass-3 re-analysis of the seven.

**Decisions and why:**
- Before-damage status triggers are opt-in (`beforeDamage`), not the
  default: the data orders actions per skill, and no current trigger
  needs the other order.
- Delayed cast-trigger actions belong to their cast (dropped when it's cut
  short) unless `detached`: SkillData timeline actions stop with their
  skill.
- A cooldown fraction is of the full cooldown, and ultimates don't get
  through `cantCastSkill` channels: assumptions, with in-game tests 36
  and 15.
- What can't be settled without the game (jumps, hit-stop, the WILL
  combo's element, …) is listed with its interim rule in
  [batch-1.md](../kit-batches/batch-1.md#pass-2-whats-still-open) rather than
  guessed in code.

**Problems:** none that moved numbers: every change kept the example
totals and log verdicts identical until a kit uses it (checked against
the previous commit each time).
