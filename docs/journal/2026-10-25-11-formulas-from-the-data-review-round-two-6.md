## 2026-10-25: formulas from the data (review round two, 6)

- **Burst and reaction DMG (35–38, 56–59):** no equippable source writes
  them (the gear sets behind buff_equipsuit_fireup_01 and kin aren't in
  EquipSuitTable; 56–59 are only read by the reaction buffs'
  StoreAttributeValue). The panel now refuses a nonzero one
  (`UNMODELLED_DAMAGE_ATTRS`) instead of dropping it; a test walks the
  data for any (with ATK and Crit Rate as its control).
- **Level coefficient:** read from the panel's attributes 49 (arts) and 25
  (physical) instead of a formula; all 3,605 CharacterTable rows equal
  1 + (Lv − 1) / 196 and / 392, so no number moved.
- **Resistance:** the table has it three ways (fields, attributes 94–99,
  scalars 80–85 = 1 − points / 100). Points now come from 94–99 (ether
  from the data, was 0 by hand); the loader refuses fields or scalars that
  disagree. One exception: eny_0125_fdcentur's scalars are 1 at 20 points;
  c3c7's 55 plain Si matches at × 0.8 say the points count.
- **Limits:** AttributeMetaTable's min / max loaded (`attributeLimits`,
  `clampAttr`): panel totals and the timeline's Haste (was 0.1–1.3 by
  hand), combo-cooldown rate and Stagger efficiency with buffs. Crit Rate
  has no limit in the table; its 0–1 stays a probability rule.
- **Silent defaults:** a missing enemy DEF is an error (every level row
  has one); a modifier's `when` the situation can't decide is an error by
  default, as for `KitHit.if` (it found one path: Arts Intensity for
  statuses judged modifiers without any situation, so a conditional one was
  dropped; it now gets the frame's); the compiler reads a crit-rate
  processor only in the Add slot (formulaItem 5; anything else is noted);
  a kit modifier of zone `atk` (ATK%) requires its game buff's ATK in
  formulaItem 6. No result moved.
- **Stacking:** a stack group's strongest instance acts whole
  (`acting` in buffs.ts; ties: the latest), not the strongest value per
  modifier, which could mix two instances. Every group's buffs have the
  same modifiers today, so nothing moved.
- **Arts Intensity for status strength** is read for no element or kind;
  the loader now refuses a filtered Arts Intensity modifier (none exists)
  instead of the context losing it.
- **One damage path each:** a status event's scale (a Combustion tick's
  damageScale, a Crush multiplier) is a scale part inside
  `computeReaction`, not a multiply and re-round after it; the finisher
  multiplier is one `finisherModifier` for the timeline and the log check
  (the check's copy fell back to ×1 silently). Left from 6's formulas:
  `Modifier` sides (today `SNAPSHOT_ZONES` stands for the attacker side).
