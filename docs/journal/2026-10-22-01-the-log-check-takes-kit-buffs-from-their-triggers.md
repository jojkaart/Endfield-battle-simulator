## 2026-10-22: the log check takes kit buffs from their triggers

**Goal:** the owner's "our engine should not rely on the log data for
activating buffs. It should activate them based on the events that should
trigger them" — for `zmdlogs check`, which predicted each hit from the
buffs the log lists (4e5e: Camille's Lustrous Carmine buffs drop out of
the log at 49 and 65.5 s; a hand note stood in).

**Done:** a kit-buff replay (`packages/cli/src/buffreplay.ts`, engine
`replayCast`): the placed casts are cast on the timeline at their logged
frames, without a rotation's checks; their logged landings land at the
logged frames (`pinned`: later time stops don't move them again), a cast
keeps its predecessor's hits when the log shows them after it started,
a combo without an open window gets one (count 1); crits are off, the
enemy's HP follows the logged damage. Instances of kit buffs standing for
a game buff the log lists are read at every logged hit. Away from its own
changes (±0.5 s, and ±10% of an expiring instance's life) the replay
decides: off removes the log's entries, on adds them where the log is
silent (values from the log's nearest listing), both on keeps the log's
entries and counts. Buffs applied on crits, chances or enemy actions stay
as logged. The report lists the disagreements (on/off, counts) and which
reading the damage fits. `--log-buffs` gives the old check. A fight's
last hit with an uncapped value above its own (the killing blow's overkill
estimate) counts as unjudgeable. 4e5e: the atkup hand note removed; Rossi
161/162 (the last, the killing blow), Gilberta 58/59 (a hand note for the
Corrosion her explosion starts at 68873 ms, which the old note hid).

**Decision and why:** the replay's reading comes first; where it fits no
reading of the hit, the log's listing is tried and the match is labelled
"the log's buff listing (replay: …)". Making the replay final broke most
fixtures (40d9 Laevatain 17 → 6, dbae Typhoeus 42 → 2, abfd 190 → 32 …):
the replay doesn't see casts without logged damage (Laevatain's ultimate
in 40d9, so `buff_wpn_sword_0006_valid` never starts; in abfd
`buff_wpn_funnel_0010_atk_up`, on the wielder's skill heals, and
`buff_equipsuit_usp_02_AddAttack` never start), and some kit triggers fire
where the log and the damage say no (`buff_chr_0035_liino_atkup` on Liino
herself, `buff_wpn_sword_0012_atk_up` instance counts, the enemy's
`buff_common_affixes_vulnerable_physical` in d4fb / d572 / de6a).
With the fallback no fixture loses a match; the labels and the per-run
"fit" counts show where the replay is still wrong.

**Findings (leads):** log gaps the damage confirms: Lustrous Carmine ATK
in 4e5e and 012ae (Arcane 69 → 155/155, Camille 81 → 122), Liino's ATK
on teammates. Time stops: the logs extend buffs by about 1.1 s across
Estella's 1.8 s ultimate stop and by about 1 s without any (4e5e), the
engine by the stop in full (in-game test 18's question). Bloodfount layer
counts in 4e5e (a heal Camille receives at 56–61 s the replay misses).
