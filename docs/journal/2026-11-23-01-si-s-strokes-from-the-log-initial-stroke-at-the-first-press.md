## 2026-11-23: Si's strokes from the log: Initial Stroke at the first press, the burst's origin

**Goal:** the brief after the Yinglung's Edge hypotheses (2026-11-22): what each of Si's logged presses is and when
Artful Intent ends, then whether N2 (her first press counts for the set) follows; and whether anything in the logs or
the data marks leaving combat (N1).

**Done:** the bursts' `poise.origin` tells how each Artful Intent ended: `normal_skill_2` Final Stroke (26), the
Inksoul returning by itself at expiry `normal_skill_inkmove_2` (22), the mark's burst (`inkmark_projhit`, 26: no
Inksoul, ended at its one press 20–34 s after the hit). Initial Stroke is the first press after the battle skill; her
other presses under Artful Intent (269 of her 276 hitless events, every ~3.3 s) do nothing the log shows. Built in the
replay (2a9a267): castsFromBuffEnds infers Final Stroke only from a burst credited to it (or to nothing); pullingPresses
makes the first press Initial Stroke (ReplayedCast.as) unless the mark's burst ends that Artful Intent; the kit's
initial_stroke trigger detached (the Inksoul comes from the entity spawned at frame 0). The engine's Edge score 54 / 4 /
10 → 61 / 2 / 5 of 68 (N2 follows from the strokes). Scoreboard: development plain 59.9 → 60.1%, mismatch 16.4 →
16.2%, mean |damage error| 9.2 → 9.3%; earlier pending 53.1 → 53.2%; verified and hold-out unchanged; c83c mismatches
31 → 0, 9555 11 → 1; 7b54 damage 48.2 → 49.0% (a combo out of the Edge test, an Initial Stroke layer more). Team
numbers unchanged (team-ab against 6b117c1: every team's own fight identical), so the owner's rules need no re-search. The detached Initial Stroke broke
examples/ink-melt-zero (its second Initial Stroke at 6.67 s, after one cut by her combo at 3.8 s, now finds the
Inksoul up): that step dropped by hand (`repair --write` dropped 80 steps instead), total 2,844,498 → 2,853,256. c83c,
e989 and 0c14's mean |damage error| +0.1–0.3 points with the layers their combos imply.

**Decisions:** Final Stroke's layer stays counted as the kit has it: no log tells (always past the cap or before the
same combo). N1 not built: the set's buffs handle no battle exit in the data (ability event 7 only in six buffs, Si's
normal_skill_check among them), the layer is the caster detector's child buff but the wearer's own layers go too; the
two clear cases are the boss Si's half-HP pause (3f78, 4a64), 7b54's is ambiguous (Jade Vessel or Camille's hitless
press). Test 106 (e) now asks about that phase change.

**Dead ends / found:** a Stagger bar back to full after a pause marks nothing (every ~5 s pause refills it). 0c14
166.7 and its ×0.288 burst: a battle skill at 157.42 s whose hit the log lacks restarted the record (0.17 × the hits
from 158.76 s = the logged 90,026). Why Artful Intent without Initial Stroke lasts until a press, and what the later
presses are, stay open.
