## 2026-11-12: Kit review against a mechanics reference

Goal (the owner): a combat mechanics reference, then every operator's kit
checked against it (flags only), then each flag judged. Done:
[combat-mechanics.md](../combat-mechanics.md) (905 lines, each rule tagged
SETTLED / DATA / ASSUMED / OPEN with its source); 33 review files in
[kit-review/](../kit-review/README.md): 68 flags, 22 more found while judging.
Real: Laevatain's two battle-skill multipliers, where the data and game-1.6
logs disagree with Zero Sanity's older in-game values (left for the owner,
test 20); one fixture input (04d4's Catcher weapon). Most flags were the
small model reading the raw kit JSON instead of the loaded kit, or unused
data fields: the method found the places, the judging pass did the work.
Several stale "no log has …" notes; Arcane's talent-1 second effect
ignored by the engine (an in-game timing decides).
