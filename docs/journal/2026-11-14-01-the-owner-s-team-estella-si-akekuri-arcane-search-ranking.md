## 2026-11-14: The owner's team (Estella, Si, Akekuri, Arcane), search ranking, loops

Goal: the owner's priority, their team simulated as well as possible, then
complete rotations (opener + loop, boundaries at ultimates' casts) for
fights with ultimates precharged and from zero energy. Done: example
scenarios with the owner's builds (both start energies) and a team page
(docs/teams/estella-si-akekuri-arcane.md); six team logs imported (one
hold-out); OBJ Razorhorn's ATK on the Shattering hit; Thermite Cutter
layers only from the wielder's own Link (`linkGained.fromSelf`; test 94);
JET checked against two Avywenna logs (values right, wielder only); the
log check values Si's Artful Intent burst from its logged window and
claims child buffs logged under affix names (Ardelia's Susceptibility
was counted twice; hold-out plain 44.4 → 61.5%); Arcane's knife edge
closed (the owner's copy of 0206's loadout is WILL with 18 s; 0206 is
game 1.5); `efsim edge`. Search: value ranking (damage + half the
probed value of held energy/SP/casts), wider beams keep the narrower
ones' best: precharged 60 s 3,061,788 → 3,286,029 (from zero it didn't
help: 3,008,031 stays). `efsim search --loop`: closing rounds at the
longest-recharge ultimate; laevatain-solo loops (31.2 s), the team
doesn't close (ultimates recharge out of step; Arcane's array). Next: a
synchronized burst loop (every ultimate ready = boundary), in progress.
Open: Yinglung's Edge stack count (test 106), Estella's Lift half-buff,
Akekuri ×0.89 in 012a.
