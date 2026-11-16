## 2026-11-16: Older development fixtures refreshed from fresh battle details

Goal (the lead; backlog after round 2, point 3): give the 79 development
fixtures imported before 2026-11-16 what newer imports keep, from a
one-off fetch of their raw details the owner approved.

Done:
- `efsim zmdlogs refresh <fixture>` reads the cached detail when
  `--detail` is omitted, else fetches it once (`refreshFromDetail`,
  zmdraw.ts). `refreshFixture` now rebuilds the hits as an import would
  (`zmdlogsHits`, factored out of `zmdlogsToFixture`) and adds every
  field the fixture lacks: casts, poise, poise.origin and, new, effects'
  and boundaryEffects' `source` / `since`, one provenance note per kind.
  The rebuilt hits must equal the fixture's but for those fields, and
  logged casts the detail's; otherwise `RefreshMismatch` and nothing is
  written. Tests on synthetic details (tests/zmdrefresh.test.ts,
  tests/helpers/zmdlogs.ts).
- Import against refresh, compared: everything an import records from
  the detail is now covered. Not refreshed, as they come from elsewhere
  or feed the computation: the team (the export, a second request), the
  enemy level (stage or total damage; where the stage names the boss,
  its level is every fixture's), the import's notes, `verifiedAgainst`.
- The fetch: 79 details, one request each, 3.5 s apart, all found, no
  parser version changed. 77 fixtures refreshed (6 multi-target ones also
  got casts and Stagger); every other field is as it was (checked against
  HEAD), and no string other than game keys and the notes was added.
- `npm run snapshots:update`: no snapshot and no scoreboard number moved
  (the fields are record-only).

Skipped: 40d9 and 4e5e (verified). Each detail now lacks a zero-length
buff lane at one hit that the fixture lists as unquantified (40d9's lane
is still there, with its dynamic effects emptied; 4e5e's is gone).
Damage and hit counts match, but the brief said not to overwrite a
detail that differs. ZMDLogs can change a stored detail
(data-sources.md).

What the new fields answered (open-problems.md): Electrification's
logged giver is the replay's applier at 3,497 of 3,505 kit hits (the 8
others in 3aa6), and the level readings that differ are in 3aa6 and
d774. Breach can't be checked from the hit export (it lists no physical
statuses). Of 79 Artful Intent bursts, 39 are credited to Final Stroke
and 33 to an Inksoul expiry; 7 deal no Stagger and record no path.
