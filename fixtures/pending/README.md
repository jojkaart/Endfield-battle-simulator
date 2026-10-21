# Pending log fixtures

Imported battle logs that the log test (`tests/logs.test.ts`) doesn't run
yet, because something outside the kits doesn't match. Move a file up to
`fixtures/` once it passes (`efsim zmdlogs check <file>`).

- `zmdlogs-e82d45c46040.json` (Rhodagn, game 1.6, parser v59): three
  unexplained factors in one fight. Perlica's Electrification reaction
  (t=7544) is ×1.209 the level III prediction (×1.200 of it is her P3
  layer, in her kit since 2026-10-20; ×1.0078 is left, batch-3 A6), Si's
  battle skill (t=2315) ×1.139, and an Arcane Cryo burst (t=8561) sits between the predictions
  with and without its boundary buffs. Something the log doesn't list acts
  on several operators; its Electrification *strength* (0.39571) does
  match (docs/data-sources.md).
- `zmdlogs-7e19489ae503.json` (Rhodagn, game 1.6, imported 2026-10-19 for
  batch 2): the Endministrator (34% of the damage, P3) with Ember, Chen
  Qianyu and Pogranichnik; Ember and Pogranichnik have no kit yet. Chen's
  21 hits are covered since her kit (2026-10-20) and mismatch: her build in
  the log looks off (in-game test 75) and the log doesn't list team
  effects that act on her (docs/kit-batches/batch-3/chr_0005_chen.md,
  section Kit). With her kit
  all 34 of her hits are covered and mismatch, for two reasons outside
  the kit (docs/kit-batches/batch-2/chr_0003_endminf.md, section Kit): the
  log doesn't list talent 2's +20% Physical DMG taken on the sealed enemy,
  and her ATK is short by what +180 flat ATK (+21.98% ATK) gives. The ATK
  is Ginseng Meat Stew, a food buff the log doesn't list (2026-10-21,
  the owner's suggestion; hand-noted in the fixture's notes and effects):
  all 34 of her hits match now.
- `zmdlogs-abfd4b7478ec.json` (Rhodagn, imported 2026-10-19 for batch 2):
  Fluorite (P5) with Si, Yvonne and Seraph. Every Si hit was ×0.965 of the
  prediction and every Fluorite hit ×0.544: build corrections from the
  log's own data (2026-10-19, provenance notes: Si attributeNodes 2,
  Fluorite promotion 3 with weapon level 20) make all 56 of Fluorite's hits
  and 186 of Si's match; the checker's finisher multiplier (2026-10-20)
  matches her four finisher hits too. Xaihi (Seraph) matches 75 of 75 with
  her kit and weapon level 60 (2026-10-20, provenance note). Left: Yvonne
  has no kit.
