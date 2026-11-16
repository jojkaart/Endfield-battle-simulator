## 2026-11-15: Ink Melt's kits checked; buff timers, Combustion, the sync loop

Goal: before simulating Ink Melt (Laevatain, Si, Wulfgard, Ardelia), make
the four kits as right as the logs allow (the owner); and the owner's team
as opener + loop. Done (sonnet diagnoses, opus fixes, all merged):
Wulfgard's kit fits (the new logs' misfits were build offsets the export
omits: fixed in five fixtures); Ardelia's kit fits (her +57–204% were the
log replay: one ultimate placed as several casts, her combo split across
stops; and two fixtures' builds), her ultimate applies no Susceptibility;
consumed buffs and Link now act on every hit of their cast however late
(Si's combo: bdf2 −11.1 → 0.0%); Si's burst no longer carries teammates'
replay misses; Si's Amp end and Ardelia's holds: the damage agrees with
the engine, the log lists buffs past their end (test 107 for the
owner); Combustion's snapshot includes the buffs its application creates,
and its own hit takes the new ATK, not the new DMG bonuses (c7790 exact).
`efsim search --loop --sync`: the owner's team loops from zero (81.1 s,
40,677 DPS; beam 8 84.3 s, 41,862) and full energy (84.9 s, 41,056).
Measured (development / hold-out plain): 38.4 / 61.3% → 45.0 / 62.1%.
Decision (the owner): a log fit is a hint; a fix needs a mechanism.
Open: long loop openers (rounds that don't settle), a 2-round loop (worth
3–10%), the re-snapshots of Combustion (458b, db87), 8915's stage factor,
791 Ardelia's sheep ×1.407, 5082 Yvonne −23%, f879 cast placement.
