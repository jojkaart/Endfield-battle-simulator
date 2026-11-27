## 2026-11-27: Log-only landings: Typhoeus's Signs, Zhuang Fangyi's Sunderblades

**Goal:** the log-only side of the fight totals (development 3.2% of a fight's logged total, hold-outs 5.1%): the
landings the log shows that the replay never makes, sorted by kind, operator and skill, fixed by mechanisms; beside
an agent on the replay-only side (placement and cast-assembly files theirs).

**Found** (docs/open-problems.md "Log-only landings"): two thirds of the development log-only mean is 9c6e (−37.8%,
two targets under one enemy id) and 6339 (−25.6%, the slug); the other 54 fights −1.0% each, spread. By cause: a
counted resource one short (fixed below); bursts and Combustion ticks 0.55–0.85 s later in the game than in the
replay, held there by a stop starting 0–300 ms after the replay's burst about half the time, both ways at the same
offsets (scripts/probes/bursts/burst-before-stop.ts: 13 held, 16 not, 11 unclear): the replay's precision, no rule;
placement and cast-assembly choices (fc63 87.87 s, f879 95.10 s, 5082 45.06 s, 9a80 34.94 s, 3aa6 125.65 s,
Pogranichnik's harasses, 99fb's bleed ticks); Arcane's INT lasers started from the logged combo event (8915, 00ae,
a7a7). The hold-outs' largest log-only kind is physical statuses the replay never deals (2.08%); every development
one but 5 of 335 has a landing, so it is not reachable from these logs.

**Done:**
- **Typhoeus's burst Signs by source** (kit assumption `typhoeus-sign-cooldown`, default `by-source`):
  passitive_enemy_listennaturalspellbrust makes arrow_energy_buffer_1 or _3 by a tag only her files use, two identical
  buffers each with its own 0.2 s adding cooldown. 1d91: Arcane's burst at 11.79 s and hers at 11.90 s both give a
  Sign, so her 28.68 s combo has the 8 it needs (7 under `shared`, the old kit), four Hunting Arrows, and the 4th shot
  at 39.72 s is a Power Shot with its 40.03 s burst, as logged. Every other Typhoeus log has 8 Signs at each combo under
  both readings, but dbae (7, its fight-start Signs), fc63 101.87 s (a burst placed 0.48 s early) and 9c6e.
- **Zhuang Fangyi's 3 s Sunderblade floor** (trigger bs_floor; engine `extendBuff` `atLeast`): both battle skills'
  frames 0–3 set every Sunderblade with less than 3 s left to 3 s (SetAbilityEntityDuration, batch-4 G6). d774 68.21 s:
  the 29.57 s blade, 1.15 s left at the 64.72 s cast, strikes in the next one: 7 strikes and the 97,192 final, exact.
- tests/kit-zhuangfy.test.ts, tests/buffreplay-typhoeus.test.ts; tests/logcasts.test.ts's d774 bound under `away`
  8 → 9% (the three hits now landed).

**Scoreboard** (`npm run snapshots:update`): development plain 81.4 → 81.5%, mismatch 6.3%, mean |damage error| 3.1 →
3.2%, one-sided fights 25 → 24, log-only 3.2%; earlier pending plain 81.4 → 81.5%, mismatch 7.6 → 7.5%, 1.6%, within 5%
22 → 21; verified and hold-out unchanged. Mixed: 1d91 (plain 352 → 354, mismatch 194 → 193, per hit 3.97 → 3.86%,
total +0.3 → +2.6%) and d774 (388 → 392, 13 → 10, per hit 2.98 → 2.78%, +4.9 → +5.8%): in both the log-only hits had
cancelled over-predictions elsewhere (d774's 103.28 s Empyrean cast, open). Typhoeus's row: median |damage error|
1.4 → 0.8%; Zhuang Fangyi's plain 86.7 → 87.0%, mismatch 3.7 → 3.4%.
team-ab against 896bb86: Estella, Si, Akekuri, Arcane unchanged (both energies); Typhoeus's team sustained full −0.38%,
zero +0.44% (within one sd), its zero bot −4.0%.
**The bot's −4.0% is the Sign reading's, and a correct consequence** (`efsim rules … --seeds 1 --assume
typhoeus-sign-cooldown=shared` gives the base's 58,952 exactly; no Zhuang Fangyi in the team, so not the floor): the bot
(reaction 0) is one deterministic 300 s run. Its presses are identical to 137.17 s; there Arcane's Nature burst at
136.43 s and Typhoeus's at 136.57 s both give a Sign, her 8th one shot sooner, so her combo window opens and rule 3
casts the combo at 137.17 s instead of after her 3rd shot at 137.43 s (one shot fewer, Perlica's ultimate 0.26 s
sooner). The run then drifts: damage is the same to 120 s, −3.7% in 120–180 s, unchanged 180–240 s, −14% in 240–300 s,
where Liino's ultimate at 276.97 s no longer comes before the fight's end (Liino −21%, Typhoeus −3.6%). The same pair
at 75.87 / 76.00 s changes nothing (her Signs were already at 8). The bot choosing differently there is the mechanism
(the rule list casts the combo as soon as it opens); the −4% is one path's fight-end luck, not the reading's value: the
32-seed means move +0.44 / −0.38%, within one sd (scratch/bot.ts, not kept: a single-run trace).

**Decisions:** `by-source` the default: the one log that decides between the readings decides for it, and nothing in
the data says the tag is the enemy's. The floor as a kit trigger on the cast at frame 0, the data's own clip.

**Left / not done:** the status landings' pairing (nearest in time order, 16 frames) as an assignment by value
(buffreplay.ts, neither agent's file this round); Arcane's INT lasers' start; the placement cases above (the other
agent's).
