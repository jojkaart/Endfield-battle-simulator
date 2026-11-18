## 2026-11-18: Si's misfit logs and Ardelia's build: build overrides and fit-build

**Goal:** the misfits of Si (0c14, 9555, c83c) and Ardelia (f978, 1d91): build offsets or kit rules, and build
offsets fitted from the hits instead of by hand (the roadmap's "build fitter with structured buildOverrides").

**Done:**
- **Build overrides and a fitter.** A fixture's `buildOverrides` sets fields over the exported `team` when it is
  read (`readLogFixture`; `readLogFixtureRaw` and `zmdlogs refresh` keep the file as written), each with its
  evidence. `efsim zmdlogs fit-build <fixture> --operator <op>` (packages/logs/src/buildfit.ts) scores every
  attribute-node count, weapon level and food by the operator's landed kit hits within ±1 of the primary reading
  recomputed with the candidate's panel (clean hits counted apart), so foods' DMG lines and crit-null hits count.
  docs/design/data.md, the log check's rule.
- **Fits** (open-problems): 0c14 Si = Kunst Tube (her teammates' food) and two attribute nodes: her ratio was
  ×1.1543 without Alesh's +0.16 DMG and ×1.1322 with it, which only an additive DMG (+0.247) with ATK ×0.962 fits;
  46 of 191 hits, 25 of 25 clean. 9555 Si = no attribute node (×0.9397). f978 Ardelia = weapon at level 60 (the
  earlier "no pair fits" read the ATK ratio, inside the hits' rounding): 107 of 139, all 55 clean.
- **0c14's step ×1.0965 at 13.25 s:** Alesh's P3 ATK and Thermite Cutter's team ATK, listed from a combo whose hits
  the log hasn't; the replay can't cast it (left: a cast inferred from a buff only it gives).
- **c83c's late combos:** now one Yinglung's Edge layer off each way (the +21% went with the consumed-buff fix).
  The engine assumption `battle-sub-skills` (main-only: sub-skills unseen by skill-type triggers) measured mixed
  (c83c 31 → 22 and 9555 11 → 1 mismatches, the hold-out row 7.4 → 7.6%), so it stays a switch; Si's
  battle-button events every 3.2–3.6 s (most hitless) are the open part (test 106).
- **1d91's Ardelia:** not a build: Liino's Medicant layers reach her later than the engine's every-beat heal
  (1 layer to 18 s, none at 23–32 s, 2–4 after), Typhoeus and Arcane at other times: the soundwave's area is the
  candidate (positions, not modelled).

**Scoreboard** (`npm run snapshots:update`, docs/accuracy.md): development plain 49.5 → 50.2%, mismatch
19.3 → 18.4%; earlier pending plain 47.2 → 47.8%, mismatch 26.1 → 23.9%; all but the hold-outs mismatch
21.5 → 20.1%, mean |damage error| 10.1 → 10.0%; hold-out unchanged; 1 log better, 2 mixed (0c14, f978: plain up,
mismatches down, their simulated totals +1.0 and −0.2 points), none worse. Si's mismatches 18.6 → 10.0%,
Ardelia's 22.2 → 12.9%. Example and kit snapshots unchanged.

**Decisions:** the fits are overrides, not edits of `team`, so a later fitter (weapon levels bounded by their
logged skill levels: WeaponBreakThroughTemplateTable isn't loaded yet) can redo them; the older hand fits stay in
`team` with notes (not migrated). No kit default changed, so the team numbers don't move.

**Dead ends:** a food alone or a node count alone for 0c14's Si (it takes both); replaying the food search through
the whole check per candidate (minutes per log; the fitter recomputes the primary reading instead, seconds).
