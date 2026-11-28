## 2026-11-28: Combo windows: Typhoeus's Signs at a burst's application; openers logged inside a combo's slow-down

**Goal:** the backlog's accuracy entry "INSIDE flags that are a shut combo window" (docs/friction/2026-11-28-backlog-after-round-23.md):
the development logs' 18 INSIDE lines held by the cast's combo window, by cause; fix what the data decides.

**Found** (docs/open-problems.md "Combo windows"):
- **Typhoeus, 5 lines** (0eef 6.77, bdf2 11.00, 1d91 8.63, d9e5 11.17, af7b 68.97 s): each floating combo pressed after a
  Power Shot's arrow (or Arcane's Nature infliction, af7b) and before its burst's damage, where the replay's 8th Sign
  came. Her talent's listener (passitive_enemy_listennaturalspellbrust) runs on abilityEvent 9, a buff added to the
  enemy, with the Nature-burst tag that buff_common_natural_natural_triggered and her Power Shot's own burst buff
  carry: the Sign comes at the burst's application, one triggerInterval (1 s, or 0.35 s for her shot) before its damage.
- **12 lines: the opener logged inside the combo's own slow-down** (2–17 frames into 18–25 frames at 0.01: 0.05–1.6
  frames of the world's time), mostly at a ms the combo's own first hit or cast event shares. The kit triggers are
  right; it is the pinned landing's ms (a placement lead, handed back).
- **3f78 19.30 s** (Arcane): her combo 17.17 s after the last against an 18 s cooldown; Gilberta's ultimate's
  infliction came while it ran. Unexplained (a reduction the kit lacks, or either combo's placement).

**Done:**
- Engine: StatusEvent `burstApplied` (landing.ts delayBursts at each burst's infliction, landHit at a burst hit's
  landing, a delayed one's before its damage; not recorded) and StatusOn burst `applied` (events.ts, the kit schema);
  Typhoeus's three Sign triggers read it. tests/burst-applied.test.ts (fails at the base: verify-at).
- Her Sign conversion moved from a delayed cast trigger (frame 35) onto her combo's first arrow (launched at frame 35):
  with the Sign at the application, fc63's conversion (her clock through Gilberta's and Arcane's combo slow-downs put it
  at 59.33 s, the logged arrow at 58.65 s) removed the Sign of Arcane's 58.77 s burst, and her 4th Power Shot at
  89.23 s became a plain shot the log contradicts. A simulated fight's frame 35 is the same.
- timing.ts startGateWords: a shut window's last opening, the skill's last cast, its latest recorded trigger and the
  cooldown that kept it shut, and a start inside the combo's own slow-down (views only).

**Measured** (`measure --at HEAD --base 1c11c35`, the views commit): no log's verdicts moved (the replay makes the
casts as logged; only the flags and the windows' facts at the casts moved); the first version, without the conversion
move, had fc63 "better" (3.2 → 0.9%) by losing that Power Shot, the reason for the move. `typhoeus-sign-cooldown`
`shared` against the default still loses 1d91's Sign (plain 354 → 352), at the applications' times now (10.83 and
10.93 s): `by-source` stays. Final measure against main at f031780 and `npm run snapshots:update`: see the
scoreboard. `npm run smoke`: only the Typhoeus zero-energy example moved (its snapshot, regenerated).

**Team numbers** (team-ab against 967d460, 32 seeds): the owner's team unchanged (its fight the same); Typhoeus's team
sustained DPS +2.60% full energy (56,949 → 58,428, sd 1,942–2,096), +3.03% zero (55,172 → 56,844, sd 2,669–3,039),
within about one sd: her combo windows open 10 frames earlier after her own shots, 30 after a teammate's infliction.

**Decisions:** not behind an assumption: the data names the event (abilityEvent 9, the tag on both burst buffs) and
five presses fit only it. The 12 slow-down cases left to the placement (their files); the INSIDE flag still counts
them (the friction report suggests a kind of its own).

**Left:** the 12 openers' placement; 3f78's cooldown; fc63's battle skills INSIDE her combo's window 0 (her clock
through overlapping combo slow-downs runs late against her pinned landings, as the conversion did).
