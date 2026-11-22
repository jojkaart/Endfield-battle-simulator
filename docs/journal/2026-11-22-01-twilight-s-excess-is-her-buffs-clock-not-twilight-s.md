## 2026-11-22: Twilight's excess is her buffs' clock, not Twilight's

**Goal:** why Laevatain's Twilight still lasts 0.1–4.6 s longer than modelled in the
closed windows (open-problems "Laevatain's Twilight runs longer than its model", in-game
tests 18 and 21), and fix it.

**Done:** every Twilight window of the 18 Laevatain logs bracketed again (last enhanced
cast, first plain cast, from `zmdlogs instances`), with the replay's holds counted from a
run with Twilight 45 s long (so holds after the modelled end count). Then each candidate
tested per window (open-problems has the table): a constant, show_weapon's 16 s, the
battle skill's full 115-frame pause, a combo hold other than 1.9 s, every 1- and
2-feature linear model over her combos, battle skills, others' ultimates and combos,
her hit-stops, a clock rate, others' stops longer than their UltimateTimeAction (bounded
by the hit-free gaps), the Stagger, P5's kill extension, refreshes by a combo or a
Scorching Heart start, a later start, an enhanced step after the end. None fits all
windows: c83c needs ≥3.1 s where f879 45.4 s allows ≤1.2 s. The game data has no
mechanism beyond the engine's (`gamedata who buff_chr_0016_laevat_ult_end`: her combo's
channel, potential_5 and show_weapon's start).

The decisive probe: Forgeborn Scathe's 20 s buff (`buff_wpn_sword_0006_valid`, listed on
her hits), created by the same ultimate and with none of Twilight's own pauses, runs past
the replay by about as much in the same windows (0.9–2.8 s in the closed ones, 3–8 s in
3440 and 9c0b). Twilight less Forgeborn contains 0 in five of nine windows and misses it by
0.09–0.43 s in four, both ways. So Twilight's model holds; what runs long is her buffs'
clock in those windows (Scorching Heart's natural ends outside Twilight too: 0.2–1.5 s in
8 of 9). Measured Twilight 17 s (+2) on every Laevatain log: no verdict moves at all, the
development and hold-out rows unchanged.

**Decision:** no kit change (a longer Twilight would put a world-clock effect into one
kit, and the accuracy doesn't ask for it). Registered kit assumption
`laevatain-twilight-clock` (test 21): `model` (default) or `forgeborn` (+1.8 s, Forgeborn's
median excess; trigger `twilight_clock_excess`), the switch for what rides on it: Ink Melt
59,662 → 61,930 (+3.80% ± 1.30, seeds 1001–1032, full energy, `efsim rules …
--assumptions`). Scoreboard unchanged (development 52.0% plain, hold-out 67.3%); team-ab
against 1ab4647 identical (the default is the old kit). Smoke: one failure, the timeline
test's list of her kit triggers (fixed). Docs: open-problems (table, ruled out, still possible),
in-game tests 18 and 21, design/rules.md's assumption list, roadmap.

**Left open:** what holds her buffs (and not cooldowns, test 18): perfect dodges' 0.6 s
world slow-down (the log records no dodges), pauses at a fight's start (9c0b: 10 s with no
hit, Forgeborn +6–7.8 s), hit-stops in part. Next: the buff clock over every log, each
listed buff's natural end against the replay's. Friction report
docs/friction/2026-11-22-twilight.md (a `--long` trace and a lane-end view would have
found the probe in minutes).
