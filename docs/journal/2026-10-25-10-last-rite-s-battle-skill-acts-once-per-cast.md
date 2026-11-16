## 2026-10-25: Last Rite's battle skill acts once per cast

The owner: "It just makes more sense that the battle skill can only be
activated once." The kit's `mirage` now ends the perfusion for the whole
team (`endBuff` without `to`; per-subject cooldown dropped): the first
controlled Final Strike of any holder brings the one Mirage pair. Before,
each member's perfusion acted once, as the data's `_tag` on the holder
reads (batch-4 B6). b6aa's log agrees with the new rule (one pair after
Arcane's and Si's Final Strikes). In-game test 83 marked decided.
Test failing first (Si's Final Strike, then Last Rite's own: one pair).
`lastrite-si` relied on the old rule (Last Rite's own Final Strike after
Si's used her perfusion): −14% (823,680 → 706,977; one pair, one Cryo
stack, one burst fewer, the combo 0.7 s later on 3 stacks). It now casts
the battle skill beside her first chain's attack 2 as well (SP allows),
which gives back exactly 823,680 (24 casts). Pending logs: the simulated
totals of b6aa and c3c7 move ≤0.8 points (fewer Final Strikes with P1's
+20%); the engine's Mirage counts there didn't move (replay gaps, open).
