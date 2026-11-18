## 2026-11-18: The Finisher gated on every enhanced basic attack (test 108, the Talos Wiki)

**Goal:** the owner pointed to the Talos Wiki's "Stagger" article: the Finisher is the first basic attack on a
Staggered enemy "that aren't under any active enhancement effects (such as Laevatain's Twilight)", and a Staggered
enemy takes no more Stagger. The engine blocked the Finisher only in Laevatain's Twilight (her kit's `available`).
Generalise it with the game's own rule, check it against the logs.

**The game's mechanism (data):** nothing in SkillData or BuffData checks the Finisher. It sits in each operator's
NormalAttack skill group (CharGrowthTable type 0); the enhanced chains are basic attacks (skillSpecification 1) in
the battle skill's or ultimate's group, switched in by a buff's SwitchModeAction (`efsim gamedata find
SwitchModeAction`: modeId `ult` Laevatain, Yvonne; `UltMode` Zhuang Fangyi; `floating` Typhoeus) or ComboCacheAction
(Yvonne's ultimate end). Four kits have such attacks: Laevatain (Twilight), Yvonne (her ultimate), Zhuang Fangyi
(Empyrean), Typhoeus (hovering). None for Chen, Liino or Arcane (the brief's guesses); Wulfgard's, Gilberta's and the
Endministrator's mode buffs are created by nothing; Yvonne's barrage maps to `attack5`, a NormalAttack skill.

**The logs** (`efsim zmdlogs stagger`, which now prints each run's Finisher and enhanced basic hits; listing only):
23 Staggers with enhanced hits, none with a Finisher while the enhanced chain runs (Laevatain 11, 7 without a
Finisher; Typhoeus 7; Zhuang Fangyi 3; Yvonne 2); a Finisher and an enhanced hit of the same operator are never within
0.45 s (`zmdlogs census --select event:power_attack --near …`, test 108's section).

**Done:** timing.ts `enhancedBasic` (the attack input is a basic attack of another skill group whose kit condition
holds, or a buff maps the input to one) gates the Finisher in `gatesFrom`; Laevatain's kit gate removed; Zhuang
Fangyi's interim U6 ("castable in the Empyrean") reversed. "No Stagger while Staggered" was already the engine's
(resources.ts `dealPoise`, the 2 s recovery included). tests/finisher-gate.test.ts.

**Numbers:** scoreboard unchanged (`npm run measure`: no log's verdicts moved; the replay places the logged casts and
none of the 14 logged Finishers of these four falls in the replay's state). Teams (`node scripts/team-ab.ts --base 470dbf0`, 32 fresh seeds): the owner's and Ink Melt identical; Typhoeus's
52,261 → 52,949 (+1.3%) full energy, 49,309 → 50,194 (+1.8%) from zero (no Finisher mid-hover; bot unchanged).

**Decisions:** the rule reads CharGrowthTable's groups, not a list of buffs, so a new operator's state chain is gated
when its kit models it; a group-foreign basic attack without a kit condition doesn't count (it would block every
Finisher; tests check there is none). The gate refuses the Finisher rather than waiting for the state's end (as the
Stagger check does).

**Left:** Yvonne's barrage during a Stagger (no log), the dive part of test 108; Zhuang Fangyi's
`attack1_ult_2_abilityrange` key, which no kit hit names (32 hit groups, open-problems.md "Smaller").
