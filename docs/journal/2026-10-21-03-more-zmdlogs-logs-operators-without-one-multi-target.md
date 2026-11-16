## 2026-10-21: more ZMDLogs logs (operators without one, multi-target)

**Goal:** the owner's "look for more logs to cover more operators …
also grab some multi-target logs" (multi-target support itself later).

**Done:** character profiles on ZMDLogs (`/api/characters/{id}/profile`,
14 requests) listed battles for the 14 operators without a log; 22
picked (two per operator, newest first, different bosses), details and
exports fetched 3 s apart. 16 single-target fights went to
fixtures/pending/ (first check results in its README), 6 multi-target to
the new fixtures/multi-target/ (each hit names its `target`; not checked).
Every operator but Avywenna (no log since 1.6) is now in at least one.
Loader: EnemyTable aliases (stage variants use their attribute template,
with modifiers: types 0, 1 and 4, the last a reading) and DungeonTable
stage levels; the importer takes the level from the log's stage.
`--detail` reuses a downloaded battle.

**Findings:** the first checks are mixed: some operators match whole
fights (Laevatain 383/384, Liino 175/175, Pogranichnik 258/258, Arcane
186/186, Si 152/153), many are off by one constant factor (build values
the log doesn't record, or food), one fight is ×0.100 for everyone (an
enemy-side effect). Not investigated yet.

**Problems:** the site is slow (1–2 MB details); a first loader version
refused an unknown modifier type and broke data loading mid-import (no
requests were sent while it was broken).
