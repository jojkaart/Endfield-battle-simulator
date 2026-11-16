## 2026-11-16: Si's Artful Intent runs its full length in the owner's rules

The owner noticed rule 9 of their team's rules (Si's battle skill at every
100 SP) ends Artful Intent early, which wastes SP (they recalled Initial
Stroke as 25 SP; SkillPatchTable has 15 at every level, as the kit has).
Measured: the early end ran 35 times in 300 s; the record itself loses
little (the next Artful Intent records again soon), and the gain came from
spending SP (Si's hit, Heat inflictions feeding reactions, team energy for
more ultimates). Letting it run and wasting the spare SP loses ~20%; spare
SP into Akekuri's battle skill (new rule 10) plays 56,423 (sd 2,039)
against 55,462 (sd 2,929), 10 seeds, from zero 56,156 against 56,370; the
earlier list is better in the first minute from zero. Into Estella's
battle skill costs her combo's trigger; into Arcane's is worse. The new
list is the example (examples/estella-si-akekuri-arcane.rules.json) and on
the team page. Lesson for the rule search: it never tried the "button
shows the plain battle skill" condition on Si, so a cue-gated variant of
each repeated press is worth adding to its moves.
