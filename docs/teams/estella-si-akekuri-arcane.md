# Estella, Si, Akekuri, Arcane (the owner's team, 2026-11-14)

The owner wants this team simulated as well as possible; it is the
current priority. Example: [examples/estella-si-akekuri-arcane.scenario.json](../../examples/estella-si-akekuri-arcane.scenario.json)
(the owner's builds, 2026-11-14: Estella P5, JET 9/9/5; Si P0, Jade Vessel
9/9/4; Akekuri P5, Thermite Cutter 9/9/5; Arcane P0, Solemn Phalanx 9/9/4;
the owner's gear pieces, base versions at full artifice and weapons at 90
assumed). Against Rhodagn Lv90, 60 s, full ultimate energy at the start:
3,061,788 (51,143 DPS; σ 1.2%, 5–95% 3.01–3.13M; Estella 37.6%, Arcane
30.8%, Si 25.3%, Akekuri 6.2%). The search's beams disagree by 4.5% (beam
12 best), so it's a lower bound. Earlier figures (3.99M, 4.75M) used the
example builds (a P5 Si).

## Where the damage comes from (sonnet, 2026-11-14)

Si 59.8%, Estella 25.6%, Arcane 9.5%, Akekuri 5.1%. Si's combo 25.6% and
her Inksoul burst (Artful Intent's end) 14.9%; Shatter 4.5%, Si's
Solidification hits 3.0%, Estella's plunging hits 4.3%, Lift 1.8%,
Arcane's bursts 1.7%. 40% of the damage falls inside one Corrosion window
(Arcane's, 2.67–17.67 s).

## What would move the total most

| # | Mechanic | Touches | Status | What verifies it |
|---|---|---|---|---|
| 1 | Si's Artful Intent, combo stack count | ~40% | logs fit Si +0.8% in ad7f; 14% mean over 21 logs | test 10; Si diagnosis (running) |
| 2 | Freezes on a boss holding Si's timers | ~15% | since 2026-11-13: a freeze on a boss holds the freezer's own debuffs (Artful Intent ends fit to ~10 ms) | test 104 |
| 3 | Corrosion's shred under freezes | up to 40% | A28–A35 settled; under freezes open | test 37 |
| 4 | Solidification's length, Shatter | ~10% | length [OPEN] | test 71 (needs Alesh), test 11 |
| 5 | Akekuri's Link and the team's SP | cast count | Link not in any log; SP not logged | test 57, test 102 |

## Logs with these operators

Si and Arcane together: 24 non-hold-out logs; ad7f (Arcane, Alesh, Si,
Estella, Tower 4) fits within ~1% for Arcane and Si. Estella: 6 logs
(engine low in the recent three: −8 / −12 / −24%, being diagnosed).
Akekuri: 3 (012a ×0.85–0.89 constant, being diagnosed; 458b fits; 5d1a
multi-target). No log has Estella with Akekuri; Akekuri's five logs with
Si fail the level-90 rule (she or Wulfgard at 80).

## Diagnoses (2026-11-14)

- **Si (sonnet, 21 logs):** her Artful Intent burst is exactly rate × the
  sum of every logged hit in its window (0.13 at P0, 0.20 from P1; within
  0.5% in ~24 of 38 windows) but the log check can't value it yet (42
  hits, ~13M): being implemented. Teammates' enemy debuffs counted ×4
  where the logs show one (Arcane's Solemn Phalanx will_susc / will_burst
  in 7b54 and 6339, Ardelia's weapon in 4e36, Xaihi's crystal Amp in
  c3c7): being fixed. Log-wide offsets in 0c14 and 9555 (known).
- **Arcane (sonnet):** most of her mismatches are multi-target logs (the
  engine has one enemy); a7a7's INT finisher lasers ×1.65 (INT only, not
  the owner's WILL build); the weapon-debuff timing above.
- **Estella, Akekuri (haiku):** her Physical Susceptibility value right
  (0.15), a later window missed in 4e5e; all 12 logged combos with a
  Shatter (test 11 unseen); Akekuri's Link and SP not in the logs; 012a
  ×0.85–0.89 constant (being checked). Estella low in the recent logs:
  being diagnosed.

## Fixes for this team (2026-11-14)

- Estella: OBJ Razorhorn's ATK on the Shattering hit (a27b, ad7f). The
  owner's Estella uses JET (wpn_lance_0011): checked on two Avywenna logs
  (7193, cfa6): values (0.336 at L9) and stacking right, buffs on the
  wielder only. Estella is Physical: JET's Arts DMG reaches only her battle
  skill's Cryo projectile (and maybe her Arts reaction hits); the rest is
  its attribute and ATK% lines. Same rotation, each fully upgraded: Valiant
  4,887,240 (+3.0%), Razorhorn 4,773,350 (+0.6%), JET 4,747,062 (a fair
  comparison re-searches the rotation per weapon). Thermite Cutter on
  Akekuri is worth ~+0.74M against the stand-in sword (team ATK).
- Akekuri: Thermite Cutter (hers) gains layers only from the wielder's
  own Link and SP, not a teammate's Link (012a, 82735, d4fb).
- Si: the log check values her Inksoul burst (34 of 40 fit).
- The log check no longer adds Ardelia's Susceptibilities twice (hold-out
  plain 44.4 → 61.5%).
