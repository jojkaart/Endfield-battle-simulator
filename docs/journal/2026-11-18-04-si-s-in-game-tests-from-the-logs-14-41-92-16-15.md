## 2026-11-18: Si's in-game tests from the logs: 14, 41, 92, 16, 15

**Goal:** decide from the logs the in-game tests on Si (14, 41, 92), the basic-attack cancel (16) and the swap
lock (15), checking the re-triage's claims (docs/in-game-tests-retriage-*.md), fixing the engine where it's wrong.

**Done** (each test's own section in docs/in-game-tests.md):
- **14 decided:** Si's battle skill inflicts Heat with a Heat operator first, Cryo otherwise, as the engine has:
  her 11 `fire_fire` and 9 `cryst_cryst` bursts (`checkReactions`) fall on that split, every predicted one with the
  engine's element, none against it.
- **41 decided:** Jade Vessel's next-combo bonus comes from her ultimate or her Immobilization, lasts 20 s (held by
  stops) and goes with the next combo, as the engine has: 37 final hits plain with it, 4 without; 6 ultimate-only
  combos plain with it; no non-plain final hit fits with it toggled.
- **92 decided, the re-triage reversed:** Long Heritage's team Arts DMG (`teamatk`, 0.112) starts with Si's Amp at all
  four of her ultimates (632c, 67d8), on every member: her Cryo Amp counts (checkType 1 reads its ID list), the
  engine's reading. The re-triage had read `teamspell` (0.168, the wielder's own Cryo DMG from her battle skill),
  which is hers alone by design. The kit notes say so.
- **16 partly:** the re-triage's Final Strikes "after her battle-skill cast" follow her hitless battle-button events
  (282 of 370 events have no battle-skill hit; test 106's open part), not battle skills; no real cast (73) has a
  basic hit of hers between its event and its hit. Whether a press drops an unlanded hit leaves no trace: still the
  owner's. Added to open-problems ("Type 50 Yinglung's Edge"): the events don't end her basic attack.
- **15 not decidable:** Gilberta is never the controlled operator in any development log (none of her 371
  Final-Strike hits deals Stagger, a controlled-only mark), so her 3.7 s lock never had anything to hold; the
  re-triage's "fresh chains" are the controlled operator's and teammates' own attacks.

**No engine change**, so the scoreboard and the team numbers don't move (snapshots:update: nothing changed).

**Decisions:** Si's Final Stroke has a `switchToBuffConfig` with `asSkillCast` and a buff (as Last Rite's beside cast),
so it may run beside her basic attack; left as a note in test 16, since no log tells a stroke from the hitless
events. Test 10 left to the queue agent.

**Dead ends:** a teammate's `attack1` as a swap marker (teammates attack on their own); the Jade Vessel enemy-debuff
lane's `since` as an Immobilization marker (whether it moves on a refresh is open: data.md).
