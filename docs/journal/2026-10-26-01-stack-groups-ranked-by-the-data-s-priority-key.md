## 2026-10-26: stack groups ranked by the data's priority key

The owner asked how "the strongest instance" was decided when two buffs
in a stack group each win at something; it was the sum of the effect
values (a crit rate added to a DMG bonus, attribute points outweighing
both), an engine guess. The owner: "Even if it's latent today, we should
consider this a bug and fix it." The game ranks by one value, the game
buff's stacking priority key (BuffData `priorityKey`). Now
`KitBuff.priority` (`from`):
- `effect` (23 buffs): one of the game buff's attribute modifiers reads
  the key, so the rank is that effect's value at creation (the kit
  modifier standing for it; ATK is zone `atk`);
- `key` (15): the key's value in the applying skill, else the game buff's
  own (as for the instance limit, B2; Tangtang's Haste: per applying
  skill, since only some have `ratio_speed`);
- `kit` (6: Last Rite's Hypothermia, Tangtang's two Waterspout
  Susceptibilities, Si's talent Haste, Grizzled Edge ×2): a parent buff
  fills the key at creation (e.g. `priority` ← `phy_dmg_up_final`, the
  same value as the effect's `phy_dmg_up`); the kit states it, each with a
  note.
tests/kits-priority.test.ts scans every CreateBuffAction in the fetched
data: a key filled from another value, or read from nowhere (no applier
has it, the buff's own is 0), must be `effect` or `kit`. Without it a
first version silently ranked Grizzled Edge's instances at 0 (the latest
acted): mifu-dapan −4.6%, which the test then caught. The instance limit's
"weakest goes" uses the same rank. Ties: the latest acts. Groups without a
priority key (wpn_pistol_0011, wpn_sword_0020): the latest acts, an
interim. No example or log result moved; 28 kit digests did (the field).
