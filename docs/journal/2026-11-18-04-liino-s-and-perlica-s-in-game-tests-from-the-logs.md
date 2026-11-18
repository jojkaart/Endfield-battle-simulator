## 2026-11-18: Liino's and Perlica's in-game tests from the logs

**Goal:** decide from the logs the open in-game tests on Liino and Perlica (Typhoeus's team) under the owner's
"Logs first" rule, and fix the engine where the logs show it wrong.

**Decided** (each in its own section of docs/in-game-tests.md): **26** Liino's volley, a plain 10 s timer (the last
entry's data and logs); **6** Liino's ultimate, the values hold (572 checked hits, 332 plain, dbae 25 of 25; the
mismatches are 7910's Tangtang weapon value, 8915's stage factor, team-wide runs in 9847 and 4d60); **67** no Knock
Down after Perlica's finisher (three finishers, while Knock Downs are logged elsewhere: 42 hits in 4 logs).
**Partly:** **25** (4 layers per teammate; left: a heal at full HP), **27** (her combo opens in Cosmovoice: d774's
Cosmovoice variant, plain; left: energy, acting after it), **68** (Wild Wanderer from her combo's forced
Electrification: 21 of 21 starts in 4 logs; the reaction half and P3's layers per reaction are in no log).
**Not decidable from these logs** (each section names the log that would decide it): **66** (no Perlica combo lands
on a stronger Electrification: 3aa6's three near-cases were consumed by Zhuang Fangyi's battle skill first), **93**
(no Camille with Liino; her talent 2 is listed after all, as `talent1_atkup`, starting only at her own combo heals,
with no other battle/combo/ultimate heal on her in any log), **28** (none of it logged).

**Engine change:** Liino's Cosmovoice has ten beats, not nine. The three Cosmovoices logged with every beat (4bfc,
4d60, 9847) have ten each, never eleven; the kit had ended the beats' buff with its 77–477 creating clip. Now it ticks
at 482 too and ends at its 15 s duration. Scoreboard (docs/accuracy.md): development plain 51.4 → 51.5% (mismatch 18.2%, error
12.9% unchanged), verified and hold-out rows unchanged (66.0%, 7.2%, 12.4%); logs better 3 (4d60, 9847, 9c6e), worse
1 (8915: its stage factor, every prediction already too high), and d774 among the earlier pending (its replay
already lands beats where the log has none); hold-out 2 better, 0 worse. Liino's row: plain 55.9 → 56.0%, mismatch
18.9 → 18.8%, mean |damage error| 17.7 → 18.2% (the extra beat where the replay's beats are already off: d774,
8915). Team (32 seeds): 52,529 →
52,563 / 49,185 → 49,206; the 60 s timeline 5,649,021 → 5,654,191 (from zero unchanged).

**Corrections to the re-triage** (model output): test 27's five "combos in Cosmovoice" were counted after repeats of
the ultimate's cast event, all after the stance had ended; test 93's "no talent-2 buff listed" missed it under its
data name; test 66's verdict stands, but for a reason it didn't give.

**Left:** the beats' timing (logged 1.35–1.55 s apart, other operators' stops; open-problems.md "Liino's Cosmovoice
beats", next: pinning them to their logged landings as the volleys are); Perlica's combo hits ×1.15–1.40 above the
engine in fc63, 3aa6, 4d60, 4360, 9847 (seen, not followed).
