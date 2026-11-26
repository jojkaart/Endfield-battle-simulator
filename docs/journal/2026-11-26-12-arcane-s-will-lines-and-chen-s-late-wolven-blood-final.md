## 2026-11-26: Arcane's WILL lines and Chen's late Wolven Blood final

**Goal:** three leads from open-problems: e82d's −8.9% (Si's combo final at 9.12 s, with Arcane's Solemn Phalanx WILL
lines listed five times), c4f3's second Wolven Blood final ending at 104.5 s against the log's 99.1 s, and Estella's
set and Susceptibility missing on Chen in c4f3.

**Done (diagnosis; no code change kept):**
- **e82d: not the WILL lines.** The game counts one will_atk and one will_dmg (stackingType 1 by priority, as the
  engine has them): the slash just before the final lists the same five lines and reads plain with two, and Si's
  finals with ×3–×4 lines listed read plain in 79cc, 9c0b, b6aa and f978. The final misses Arcane's combo
  Susceptibility (doubles_susceptibility): its lane ends at 8925 ms, between Si's last slash and her final, and the
  final read as a crit without it is the logged value to 0.01%. 6339 shows the same at Si's final. What ends it is
  open (the seal's replacement chain, a control ending the SealAction, a stage rule in 6339): open-problems, round 5.
- **c4f3: a layer short, not the final's clock.** The first final ends at 49958 ms, a crit's ms; that hit reads without
  the final and its layers, and the layer it adds survives the clear. The replay ended the final 42 ms later (the
  placement takes the end-boundary hit as listed), wiped that layer and reached the second final 2.7 s late. Taking
  every end-boundary hit as past the run (engine assumption `boundary-ends` `before`) fixed c4f3's finals (plain 223 →
  233) but measured mixed (development |damage error| 6.3 → 6.4%, 4360 −9 and 9555 −16 plain): dropped,
  docs/tried/2026-11-26-boundary-ends-before.diff.
- **Estella in c4f3: one batch's order at 7.05 s.** The replay lands Chen's combo first, shatters the Solidification
  with it and takes Estella's combo as its not-Solidified variant (×2.86 low), so neither her Physical Susceptibility
  nor her set's trigger come; the log credits the Shatter to her combo. The fix lies in the batch's landing order
  (castassembly.ts, another agent's file this round): left for the lead.

**Decisions:** no team numbers (no engine or kit change kept, team-ab not run). The boundary rule stays out: a lane's
end at a hit's ms isn't one side of the hit in general; c4f3's case is decided by that hit's own value.

**Left:** what ends Arcane's doubles Susceptibility before Si's final (e82d, 6339); a bound from an end-boundary hit's
value; the order of landings batched at a stop's end (c4f3 7.05 s). Friction report
docs/friction/2026-11-26-arcane-will.md.
