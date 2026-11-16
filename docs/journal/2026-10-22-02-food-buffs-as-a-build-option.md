## 2026-10-22: food buffs as a build option

**Goal:** the owner's "simulations, searches and the log checker should
count food buffs" (roadmap item 4).

**Done:** UseItemTable fetched (both sources agree); a checked loader
(`packages/data/src/foods.ts`): the 36 items whose buffs persist on one
operator, each buff's attribute modifiers at the item's values, names from
ItemTable. `Build.food` (schema: one item ID, which is the game's one-food
rule: all share one stacking key). The food's lines are stat-panel lines
(`food <name> (<buff>)`), so `efsim calc`, simulations, searches and the
log checker all see them; `efsim find food` lists them. 7e19's and e82d's
stew is now the builds' `food` (set by hand, notes say so) instead of
hand-added atk effects: still 34/34 and 21/22, and every check and
reaction output is unchanged, as are all example totals.

**Decisions and why:**
- Panel lines, not timeline buffs: a food's buffs are attribute modifiers
  like gear's, in the same formula slots (the stew's 180 is flat ATK, slot
  7, which no buff zone has), and kit values that read attributes see them.
  The duration is kept: the timeline switches to the panel without the food
  at its end (`panelAt`, every panel read now takes its frame), the checker
  by hit time.
- DEF +x% (8 foods, two of them strong crit foods) is formula item 1,
  unknown: kept out of DEF and refused where DEF is read (kit values,
  Catcher's P1 strike), instead of refusing the foods (in-game test 98).
- Defensive lines (DMG taken ×, heal bonuses) load as panel lines nothing
  reads; items used for an instant effect (heals, ultimate energy) aren't
  foods and a build naming one gets the reason.
- A logged food buff that is the hitter's food is dropped from the hit
  (`withoutOwnFood`), so 40d9 and b7b3 (which log percentage foods) check
  the same with or without the food set; those fixtures leave it unset.

**Left:** a search over foods; the importer could set a food the log lists.
