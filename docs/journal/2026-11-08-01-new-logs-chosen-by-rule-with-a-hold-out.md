## 2026-11-08 / 09: New logs chosen by rule, with a hold-out

Goal (the owner): pick logs whose builds need no guessing, rather than
fit inputs to logs. Agreed rules in the accuracy plan ("Choosing logs").
Screened 80 loadouts (export endpoint, 3 s apart) from the favourites'
profile lists: level 90 everywhere, parser v59, single-target stages,
favourites spread (Rossi added to them). 17 single-target logs imported;
9 turned out multi-target (not visible before import); Tower 1 refused
(a stage buff's zone). A third of the 17 is a hold-out, drawn by fixed
seed before any check was read: measured only, never debugged. Decoded
along the way: `weaponRefine` = weapon potential + 1, and the logged
unique-skill level includes it, so the engine was already right there.
