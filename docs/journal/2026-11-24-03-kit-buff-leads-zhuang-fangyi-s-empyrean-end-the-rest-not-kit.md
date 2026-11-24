## 2026-11-24: Kit buff leads: Zhuang Fangyi's Empyrean end, the rest not kit values

**Goal:** the misprediction analysis's largest one-buff leads (its "one kit buff the replay has wrong, the listing
right" class, ~20% of the off error): Arcane's weapon, Will burst and Susceptibility buffs, Gilberta's weapon, Zhuang
Fangyi's weapon and Sunderblades, Typhoeus's Hovering ATK, then the list; fix or rule out each, double counts first.

**Done** (open-problems "Misprediction statistics", "The kit buff leads"; tables rebuilt with build.ts at c6f1874,
per buff the new scripts/probes/stats/onebuff.py; no double count among them, doublecount.py's pairs unchanged):
- **Fixed: Zhuang Fangyi's Lone Barge ultimate buff (1.0%).** The log's `ultimate_skill` events 30–35 s after an
  ultimate's are the Empyrean's end (ult_end casts ultimate_skill_end): no time stop follows, her next hits are her
  plain forms, Lone Barge's buff isn't listed after them (4 of 4; the 9 real casts list it;
  scripts/probes/kits/zhuangfy-empyrean-end.ts). The replay made each a press (a 78-frame stop, the buff 25 s more).
  The empyrean buff now ticks once at its end, logged as the ultimate (`every`, `ticksLoggedAs`, `endFollowsTick`: no
  code change). Test: tests/slow/log-cases.test.ts (4bfc).
- **Ruled out as kit leads:** Arcane's Susceptibility layers (one e82d hit read two ways is 88% of it); "Arcane's weapon
  Arts DMG Taken" (Detonation Unit, 96% of it 9c6e's second target); Arcane's Will burst buff (it starts at her logged
  burst in 90 of 91 runs, scripts/probes/kits/arcane-will-burst.ts: its error is her bursts', replay-only after her
  touch or ultimate or seconds early across stops); Gilberta's weapon (4a64's instance lasts 16.5 s of world time where
  two ultimates' stops overlap 1.5 s in the placement); Typhoeus's Hovering ATK (the 5th shot's burst, and a floating
  start pressed inside her combo's frames 0.14–0.18 s before the replay's, scripts/probes/kits/typhoeus-press.ts);
  Xaihi's Crystal Amp (Max HP, not simulated); Laevatain's Scorching Heart (a Melting Flame refresh the replay lacks).

**Scoreboard** (`npm run snapshots:update`): development plain 67.8 → 67.7%, mismatch 11.5 → 11.6%, mean |damage
error| 7.0%; hold-out plain 78.3 → 78.4%, 5.9%, 8.5% (1 better); earlier pending plain 64.2 → 64.4%, mismatch 14.2 →
14.1%, 4.4%; all but the hold-outs 5.5%. 4bfc mixed, per hit closer (plain 795 → 819, mismatch 29 → 15, total 0.3 →
−0.8%); **4d60 worse** (plain 707 → 696, −1.8 → −4.1%): the phantom stop held Arcane's Solemn Phalanx runs, Perlica's
weapon and a Sunderblade 2.6 s that the game holds 3.6–6.1 s by something unlogged around 98–143 s (those hold bounds
dropped). Teams (team-ab against c6f1874): every team's fight the same (no team has Zhuang Fangyi).

**Decisions:** kept the Empyrean fix with 4d60 worse: the mechanism is decided by the log (no stop, plain forms, no
buff after the event, 4 of 4), and 4d60's loss is an unexplained hold the phantom stop happened to cover. The hold
placement still counts the phantom stop (buffreplay.ts replayedCastStops, the other agent's file): in the friction
report, not changed.

**Left:** 4d60's 3.6–6.1 s of unlogged holds (its Stagger window takes none); Arcane's bursts (test 33's element, the
burst's clock across her own ultimate's stop); Zhuang Fangyi's d774 104.18 s Empyrean battle skill (3 logged hits, no
final, the replay 8 and the final).
