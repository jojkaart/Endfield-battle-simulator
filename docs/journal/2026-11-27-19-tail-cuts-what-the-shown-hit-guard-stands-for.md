## 2026-11-27: Tail cuts: what the shown-hit guard stands for

Goal: the backlog's accuracy entry "A tail-cut test better than the own-landing pass"
(docs/friction/2026-11-27-backlog-after-round-20.md): replayrun.ts tailCuts' "a logged hit of its operator's casts no
other cast holds" guard passed on the cast's own last landing, logged a fraction of a ms into its frame (143 of the
development logs' 217 TAILKEPT lines, `[shown-own]`); making it exact had cost c4f3 −66 and 9847 −21 plain
(docs/tried/2026-11-27-tail-own-landing.diff).

What the kept tails supplied (cli-ab `--hits-zones` with the exact guard against the tree, then `zmdlogs replay`):
- **c4f3** (all 78 moved hits after 109 s): one cast, Pogranichnik's battle skill at 108.08 s. Its logged hit at 109.01 s
  carries hit_2's value (29,561), the replay's first hit is 23,848; the tail's hit_2 at 109.33 s sets off the Breach
  the log has at 109.01 s, and its Fervent Morale stack and weapon's team ATK, which the 78 later hits read. The other
  three shown-own tails in c4f3 (basic attacks) move nothing.
- **9847** (22 hits, 78–114 s): Liino's battle skill at 75.44 s. Its volley timer opens at the cast's frame 45 (76.94 s),
  after its last logged projectile (75.83 s); cut there, the volleys the log has from 78.36 s and every 10–12 s after
  never come. Not a landing of the cast: the timer is a frame action, the volleys a kit buff's hits.
- Nothing later needed the rest: of the 143, 106 are cut now (TAILCUT 152 → 244 over 61 logs), most of them basic
  attacks' last hits; the rest are kept by another guard or left by the round limit.

Done (e7d8e08, c542358):
- The cast's own logged landings are no evidence. In their place: `landed` (a logged hit no cast holds with a tail
  landing's event within 16 frames: the free match's reach), `status` (a logged status hit of its operator whose
  nearest status landing of its kind the tail set off: c4f3's Breach; d572's Mi Fu battle skill Crushes at 125.40 and
  144.84 s),
  `shown-free` (as before, without the own pass), `effect` (as before) and `needed`: replayrun.ts cutTails (the loop,
  moved out of buffreplay.ts replayKitBuffs) undoes a cut whose replay loses a logged hit's landing (loggedShown) and
  keeps the tail. `needed` caught 9847's volleys and 7b54's Laevatain attack 5 at 46.47 s, whose hit_2 breaks the
  Stagger and so times Arcane's lasers (the log's at 47.62 s).
- `fight-end` at 0.5 s (TAIL_END_MS; was TAIL_NEAR_MS, 1.5 s): the kill drops only what comes after it. 0eef's Liino
  combo hit2 at 8.80 s (the team's hits logged to 10.03 s) and 79cc's Ardelia attack3 projectiles at 54.47 s (to
  55.95 s) are cut; measured as a variant, no other log's damage moved.
- TAILKEPT `rounds`: casts the 8-round limit leaves uncut, which were silent before (45 casts in 10 logs; d4fb 11,
  d572 9, 458b 7).

Measured after merging main at fa2c2ad (the target-deaths round; `npm run measure -- --base fa2c2ad`) and the
scoreboard (`npm run snapshots:update`): development plain 84.3% (unchanged; the exact guard alone was 83.7%), mean
|damage error| 1.3 → 1.2% (15 better, 4 worse); verified 1.6 → 1.5% (0eef 2.3 → 1.3%, 4e5e −3.0 → −3.3%); earlier
pending plain 84.4% (abfd 414 → 412), 1.2% (6 better, 3 worse); several targets plain 71.6 → 72.1% (7b54 117 → 121,
−2.3 → −1.0%), |damage error| 4.6 → 7.6% (6339 +0.1 → −10.4%); hold-out plain 82.5%, |damage error| 5.9 → 5.9% (4
better, 4 worse, the worse ones in basic attacks' totals). Against 14fe159 the same but for several targets (6.3 →
9.4%, 6339 −6.3 → −16.8%) and the hold-outs (5.8 → 5.9%). Replay-only share: development 1.1 → 0.9%, hold-outs 2.4 →
2.3%, several targets 16.4 → 13.1%; by operator Liino 8.5 → 5.6% (0eef no longer her largest), Laevatain 9.0 → 6.5%.
A test fixed: tests/logcasts.test.ts's
b7b3 `absent` case (Last Rite's third slash is now cut, as the fixture's note reads it; the `absent` path is tested
under `unlogged-tails` `kept`).

Decisions and why:
- Worse logs are under-predicted fights whose unlogged tails had cancelled part of it: 6339's Laevatain finisher hit_2
  at 21.60 s (105,356, 10.2% of the fight, no log line; at fa2c2ad it offset the log-only rest to +0.1%, its first
  hit the slug's kill at 20.37 s, Camille's Vesperwings moving at 20.60 s), db87's Laevatain ult_attack2 at 38.57 s (38,477), 4e5e's,
  a9d7's, de6a's and d774's basic tails; the same shape as `cut-all`'s adoption (docs/design/assumptions.md). abfd −2:
  two logged Si attack-4 hits at 64.10 s, pinned to an attack 4 her next one cut at 64.07 s, had matched the later
  cast's tail 0.33–0.43 s on; the cut is right, the interrupted cast is the open part (open-problems).
- The counterfactual check rather than more static guards: a tail's effects reach the log by many paths (a frame
  action's timer, a status, a Stagger break, SP), and the replay already makes the cut run; a rejected cut costs one
  round. 16 rounds instead of 8 measured worse (development 1.2 → 1.3%, no plain change, 135 against 115 s): kept 8.
- loggedShown pairs no landing once only (looser than buffreplay.ts's free match); kept so, as it errs towards cutting
  only where the log has nothing near (the friction report's point 1 for a shared pairing).

Still open: a tail whose effect shows only in later hits' values (a kit stack, a buff the log doesn't list);
several independent tails per replay (the round limit's 45 casts); abfd's interrupted attack 4.
