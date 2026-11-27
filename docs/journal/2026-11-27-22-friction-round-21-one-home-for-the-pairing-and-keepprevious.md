## 2026-11-27: Friction round 21: one home for the pairing and keepPrevious, counterfactual replays, measure's split by what it measured

Goal: improvement round 21 over five reports and round 20's backlog (summary:
docs/friction-done/2026-11-27-round-21.md; what's left: docs/friction/2026-11-27-backlog-after-round-21.md).

Done: landingpairs.ts pairKitLandings (the replay's kit-landing pairing, moved out of replayKitBuffs); one keepPrevious
rule (castassembly.ts keptPrevious / isPreviousCast) with ReplayedCast.keepPreviousWhy and a CUTS line that says the
hits are kept; ReplayOptions.cutCasts and counterfactual.ts: `zmdlogs decisions --why-kept <fixture>`; HitRecord
.target.landing and `≠ landing`; measure's code errors as "not measured alone", refs pinned at queue time, a
cross-hunk name warned at queue time; tests/enemy-readers.test.ts; `gamedata handlers`, `find`'s disabled parent;
skillCompile.ts Ctx.channel; placementwords.ts; `statuses --inflictions`; `hits --layers <owner:id>`; `tried.ts
refresh`; snapshots:update refusing a tree edited since queued; MISSED `rounds`; lint:changed's registry tests;
friction.ts withoutNumbers; edit.ts's unclosed `end` block.

Decisions: every change behaviour-preserving. cutTails' `needed` stays on loggedShown (pairKitLandings there moves abfd:
the accuracy list). The compiler's channel token keeps the old `!detached` filter: without it 9 kit hits of channels in
a buff's or entity's own file would gain an end (the accuracy list). The check's target ids: 6339 agree with the
landings', 9c6e but one, 7b54 147 of 210 differ (SECOND_PASS_TARGETS `free` numbers afresh): a view and a test now,
the fix on the accuracy list. `hits --against` already answered the statuses-per-target report's point 3 (the
round added the target to its lines). The statuses view and the DEATH lines from the replay's record came with the
statuses-per-target round; this round added the inflictions. Round 20's backlog point 1 (clocks around a non-cast
hold) parked, carried twice without a new report.

Checks: `npm run snapshots:update` at 95a4f66: every group "unchanged", "No log's verdicts moved", no key added;
the compiled game data's sha1 the same at HEAD and after the compiler move (no engine number can move: team-ab not
needed); every development log's keepPrevious flags the same under the one rule (10458 casts); cli-ab identical on
the views touched.
