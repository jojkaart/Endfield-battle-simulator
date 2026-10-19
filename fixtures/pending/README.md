# Pending log fixtures

Imported battle logs that the log test (`tests/logs.test.ts`) doesn't run
yet, because something outside the kits doesn't match. Move a file up to
`fixtures/` once it passes (`efsim zmdlogs check <file>`).

- `zmdlogs-e82d45c46040.json` (Rhodagn, game 1.6, parser v59): three
  unexplained factors in one fight. Perlica's Electrification reaction
  (t=7544) is ×1.209 the level III prediction, Si's battle skill (t=2315)
  ×1.139, and an Arcane Cryo burst (t=8561) sits between the predictions
  with and without its boundary buffs. Something the log doesn't list acts
  on several operators; its Electrification *strength* (0.39571) does
  match (docs/data-sources.md).
- `zmdlogs-7e19489ae503.json` (Rhodagn, game 1.6, imported 2026-10-19 for
  batch 2): the Endministrator (34% of the damage, P3) with Ember, Chen
  Qianyu and Pogranichnik; the other three have no kit yet. With her kit
  all 34 of her hits are covered and mismatch, for two reasons outside
  the kit (docs/kit-batches/batch-2/chr_0003_endminf.md, section Kit): the
  log doesn't list talent 2's +20% Physical DMG taken on the sealed enemy,
  and her ATK is short by what +180 flat ATK (+21.98% ATK) gives, from a
  source the log's build doesn't show. With both added, 33 of 34 match
  and the Crush hit is within 0.003%.
- `zmdlogs-abfd4b7478ec.json` (Rhodagn, imported 2026-10-19 for batch 2):
  Fluorite (P5) with Si, Yvonne and Seraph. Every Si hit was ×0.965 of the
  prediction and every Fluorite hit ×0.544: build corrections from the
  log's own data (2026-10-19, provenance notes: Si attributeNodes 2,
  Fluorite promotion 3 with weapon level 20) make all 56 of Fluorite's hits
  and 186 of Si's match. Left: Si's four finisher hits are ×1.75, Rhodagn's
  finisher multiplier, which `zmdlogs check` doesn't apply yet; Yvonne and
  Seraph have no kits.
