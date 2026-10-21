# Multi-target log fixtures

Battle logs against several enemies at once, imported with `efsim zmdlogs
import` (it puts a battle here when its hits land on more than one enemy
ID). Each hit names its `target`; enemy-side buffs are matched to the
target's enemy type, so enemies of one type (summoned hounds) aren't told
apart. The enemy level comes from the stage (DungeonTable), or 90 is
assumed (provenance notes say which).

The engine doesn't model several targets yet, so `tests/logs.test.ts`
doesn't run these. They're kept for developing multi-target support.

| Fixture | Stage | Enemies | Team |
|---|---|---|---|
