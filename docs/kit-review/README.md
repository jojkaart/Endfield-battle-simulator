# Kit review (2026-11-12)

The owner's three-phase method: a combat mechanics reference
([../combat-mechanics.md](../combat-mechanics.md), one opus pass), then a
review of each operator's kit against it that only flags (eight small-model
passes, one file per operator here), then a judgement of every flag against
the data, the loaded kit and the logs (eight sonnet passes, the "Verdict"
lines and each file's "Phase 3 summary"). Equipment kits were reviewed only
where an operator's file says so.

## Outcome

33 operators, 68 phase-2 flags, 22 added in phase 3 (N-flags).

- **REAL: 2**, both Laevatain's, both on one question (in-game test 20):
  - F3: the empowered extra hit is `atk_scale_3 × ratio` in the data, the
    kit has `× extra_scaling` (from Zero Sanity's in-game table).
  - F4: Twilight's enhanced battle skill hits 1 and 2: the kit has
    `× ratio`, the data none.
  Tried (2026-11-12, reverted): with the data's reading e989 goes from 6
  mismatches to 0 (+7.2 → +2.5%), development plain 42.4 → 42.6%,
  hold-out mean |damage error| 18.5 → 18.3%; db87 (P1) −8.1 → −10.6%.
  It breaks Zero Sanity's three in-game values (57552, 19732, 22124),
  measured at game ~1.1; the logs are 1.6. **Decided by the logs 2026-11-13**
  (in-game test 20: the data's reading fits 18 hits exactly, the kit's none;
  db87's ×1.3 is a sword buff, both readings). Was **the owner's call**: a game
  change since 1.1, or a log effect. Test 20 decides.
- **REAL, a fixture not a kit: 1.** 04d4's Catcher weapon isn't level 90
  (her logged weapon skills [3, 2, 3]): at level ~1 every ATK hit fits
  ×1.0265 (spread < 0.1%). Not yet corrected: 04d4 is an older import
  (operators at level 80) outside the screened set; recorded as a lead.
- **NOT A PROBLEM:** most phase-2 flags. The commonest cause: reading the
  kit JSON instead of the loaded kit (the loader fills counts, frames,
  poise, SP and energy from SkillData), or a data field that isn't used
  (an `atkScale` beside an `AtkScaleCalculation`, a `value` beside
  `useBlackboardKey: true`). The small model's flags were mostly wrong;
  its value was the list of places to look.
- **UNCERTAIN:** each names what decides it (mostly in-game tests already
  written: 19, 20, 36, 51, 61, 64, 71, 78, 98, 103, 104).

## Found on the way (not kit errors)

- Stale kit notes, documentation only: "no log has …" for Antal, Alesh,
  Ardelia, Akekuri, Wulfgard, Arclight and Last Rite's Mirage (each now
  has a log); Tangtang's combo-window note; Si's infliction-type numbers;
  Akekuri's SP sentence; Liino's finisher note; Arcane's attack-5 Stagger
  (10 in the note, 17 in the data and the engine).
- Arcane N1: talent 1's second effect (paramType 4, −6 on the INT combo)
  is ignored by the engine; if it's a further cooldown cut, INT combos
  come twice as often (an in-game timing decides).
- Da Pan's only log (10df, multi-target) is ×1.25 on half his hits, as is
  Pogranichnik's in the same fight: a fight-wide factor.
- Ember: one constant per player (×1.0226 in 04d4 and 146d, ×1.0444 in
  2fd9 and 99fb, none in 7e19), every hit type alike: a build input.
- Chen: the ultimate in a27b ×1.096 high, from a weapon buff
  (wpn_sword_0017 `ready`) and Gilberta's susceptibility, not his kit.
- Xaihi: c3c7 has all her hits at ×0.337 (a build offset in a fixture with
  242 problems).

These are in [../open-problems.md](../open-problems.md) where they're
accuracy problems.
