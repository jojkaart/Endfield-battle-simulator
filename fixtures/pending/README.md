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
