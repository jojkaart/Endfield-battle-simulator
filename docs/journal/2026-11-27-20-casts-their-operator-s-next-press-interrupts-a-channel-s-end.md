## 2026-11-27: Casts their operator's next press interrupts: a channel's end

Goal: the tail-cut round's open part (docs/journal/2026-11-27-19-tail-cuts-what-the-shown-hit-guard-stands-for.md):
abfd 64.10 s, two logged Si attack-4 hits cut with an attack 4 her next one interrupted at 64.07 s; more generally,
logged hits that land after their operator's next cast started.

Survey (a scratch pass over every development and multi-target log's placement, then every replay's NOLAND lines):
of the logged hits placed into a cast after another of their operator's casts started, nearly all are as they should
be (detached hits, combos beside, a chain step's hit at its own frame that the next step's placed start precedes:
keepPrevious keeps them). The replay cut a logged landing with the next cast in 10 places in 6 logs: abfd 64.10 s
(the channel below), fc63 94.79 s and c779 70.73 s (a hitless event cast between, below), and three multi-target
logs (69e7, 7b4e, b74c: Si's batched several-target hits, not followed).

Found and done:
- **A channel's end.** Si's attack 4 is a ChannelingAction from frame 5 to 40, at most 6 ticks per target 0.1 s apart
  (the kit's frames 5–20 are the earliest; an enemy in reach late takes them up to frame 40), and its skill lasts
  552 frames, so the placement's "slots to come within the skill's action" joined ticks 1.8 s late: abfd's six ticks
  at 63.77–64.35 s (the cap's six) took the 61.79 s cast's four slots left and made a second cast the replay then cut.
  The kit compiler now records a capped channel's end on its ticks (CompiledLanding.latest → KitHit.latestFrame, not on
  what a tick's buff deals later: Rossi's combo afterhits); placeWith joins no tick of one channel past it
  (`pastChannel`: by CHANNEL_SLACK_MS 400 ms, or by ON_TIME_MS with a press of the operator's between; not across an
  ultimate's event, whose stop the pass doesn't have yet: c83c 92.48 s). abfd 63.77 s and c3c7 33.64 s (past by
  0.63 s) and 60.64 s (0.17 s, a battle press between) are new casts; Liino's attack 2 (9090 93.91 s) and Arclight's
  attack 4 (4bfc 52.23 s), 0.21–0.23 s past with no press, stay. LoggedCast.pastChannel records it; its casts-view
  line is held back (docs/tried/2026-11-27-channel-decision-line.diff: views.ts was the statuses agent's file).
- **A channel's ticks in turn** (drivers.ts replayCast): an unpinned tick after a pinned late one comes as late, and
  none past the channel's end. c3c7 32.33 s: the 6th tick sat at its kit frame beside the 5th, pinned 3 frames late,
  so the tail cut didn't take it for a tail; 7910's Tangtang shots past their channel are gone.
- **The previous cast past a hitless one** (castassembly.ts ordered): keepPrevious compared each cast with the one
  just before it, a cast made from a log event alone too (a press that did nothing, a kit buff's tick the replay
  skips), so the cast before that lost its later logged hits: fc63 94.79 s (Arcane's combo event, an Imprisonment
  tick), c779 70.73 s.

Measured (`npm run measure -- --at HEAD --base 5b08218 --split hunks`) and the scoreboard (`npm run
snapshots:update`): development plain 84.3%, |damage error| 1.2 → 1.3% (7910 −0.8 → −1.2%, c779 0.8 → 0.9%, +1
plain); verified 1.5 → 1.4% (0eef 1.3 → 1.1%); earlier pending plain 84.4%, 1.2% (abfd 412 → 414 plain, 2.2 → 2.1%;
4e36 better; c3c7 2.1 → 2.2%); several targets unchanged; hold-out unchanged (one log's totals moved, no verdict).
Worse, explained: 7910 is under-predicted and the replay-only Tangtang shots that offset part of it were past their
channel; c3c7's three new attack-4 tail cuts use up the tail cut's 8 rounds, so its 101.77 s attack 1 tail stays
(TAILKEPT `rounds`, the known limit); c779's newly landed hit is matched, its total over by 0.1 point more.

Dead ends: the first version marked every landing a channel's tick body made, a buff's later ticks too (Rossi's
afterhits got frame 25 as their end: 9a80 280 → 206 plain, 0c14 −54) and applied the bound to a skill's separate
one-tick channels (Laevatain's normal_skill_during_ult: db87 236 → 199); a slack of 150 ms split Liino's and
Arclight's channels, and a 400 ms one alone split c3c7's five ticks at their fourth (a cascade into the next cast).

Still open: the multi-target cut landings; the CUTS record still flags an interrupt whose hits keepPrevious keeps
(c779 70.67 s; replayrun.ts castFlag, the other agent's file); 4a64 16.93 s (Arcane's batched attack 4s, a value
question, not this shape); the tail cut's round limit.
