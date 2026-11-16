## 2026-11-16: Does Si's Haste need Initial Stroke? (the data: yes)

The owner doubted that Si's talent Haste comes only on the Inksoul path
(the kit gives it when the Inksoul ends). BuffData creates
talent1_speedup in two places only, both on that path:
xianjing_linkline (the Inksoul) at its finish and xianjing_inkboom
(Final Stroke) while the target has Artful Intent; Artful Intent's own
end without an Inksoul (xianjing_inkhurteffect buffEvent 2, the inkmark
projectile) creates none. The kit was right; its notes now cite this,
and tests/kit-si.test.ts pins the three paths. The logs can't check it:
ZMDLogs records no Haste (four raw details fetched to the scratchpad:
2 Final Stroke, 4 Inksoul-expiry, 3 no-Inksoul ends, no speed-up buff),
and fixtures keep only buffs with damage effects. In the 39 non-hold-out
Si fixtures: 26 bursts without an Inksoul, 56 with (22 look like Final
Stroke, 4 are expiry by the raw log's `poiseDamage.orig_source`, 30 at
expiry can't be told apart from a late Final Stroke without the raw
log), 20 Artful Intents with no end logged. The raw detail's
`orig_source` tells the paths apart (normal_skill_2: Final Stroke;
normal_skill_inkmove_2: the Inksoul expiring). It matters: for the
owner's team, Initial Stroke right after the battle skill is +3.0%
(56,423 against 54,760, 10 seeds) with the data's reading and −3.0%
(55,883 against 57,630) if every burst gave Haste. In-game test 109
asks the owner to look for the icon.
