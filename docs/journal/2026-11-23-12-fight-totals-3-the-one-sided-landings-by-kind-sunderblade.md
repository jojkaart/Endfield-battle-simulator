## 2026-11-23: Fight totals 3: the one-sided landings by kind, Sunderblade variants, Si's burst paths, the Barrage Array's pace

**Goal:** the totals' error is mostly one-sided (12 of 13 hold-outs: replay-only 7.3%, log-only 6.2%, |matched|
2.5%): classify every one-sided landing by kind, rank the kinds, fix the largest shared ones.

**Done** (docs/open-problems.md "Fight totals", round 3, items 10–12):
- **The view.** packages/logs/src/onesided.ts: each replay-only landing and log-only hit by where it sits (twin like /
  other: an opposite-side landing of its operator within 1.5 s; unread; twin uncounted; its cast's logged landings:
  no cast, cast unlogged / tail / head / gap; the replay's reason for no landing, a status's split by dealt within 5 s,
  by another operator, not at all), nature, skill kind and flags (stop, cut, next cast, end, away).
  `efsim zmdlogs totals <fx> --kinds`, `totals --all --kinds` (per group, then by operator and key); measure's summary
  "One-sided landings by kind" (each group's means, the hold-outs' only view, never a log, operator or key).
- **Zhuang Fangyi's Sunderblade variants in turn.** Another variant's hits were slot alternatives only at a slot's
  frame, which an 8-blade cast's never are: nothing pinned, strikes matched by time, a final for a strike (3aa6 87.5 s).
  Now a variant's n-th landing is the slot's n-th turn at its own frame (logcasts.ts `Slot.at`).
- **A trigger's alternative paths, one landing.** Si's Artful Intent burst through the Inksoul or as the mark (and
  Typhoeus's arrow rain sub1 / sub2, Last Rite's phantom): a logged hit of one path takes the replay's landing of the
  other (buffreplay.ts `alternativeEvents`), a recorded burst within 60 frames (c779, 4e36).
- **A detached series at its own pace.** Typhoeus's Barrage Array's 18th tick, after her own ultimate's stop, was a
  combo of its own whose hovering conversion gave three Hunting Arrows (fc63 95.1, 96.5 s power shots the log hasn't):
  the next slot's landing within the slots' gap of the last one's is the same cast's (`paced`).

**Scoreboard** (`npm run snapshots:update`): development plain 67.1%, matched 83.4%, mismatch 11.7%, mean |damage
error| 7.3 → 7.2%, within 5% 24 → 25; hold-out 77.5%, 91.8 → 91.9%, 6.2%, 9.1 → 8.2% (1 better, 1 mixed, 2 other);
earlier pending 62.7 → 63.0%, 84.9 → 85.2%, 14.8 → 14.5%, 4.9 → 4.8%; verified unchanged; all but the hold-outs 5.9 →
5.8%, within 5% 48 → 49. Better: fc63 +6.8 → +3.3%, 3aa6 −2.1 → −1.6% (plain 380 → 394), 4d60, c6d8; mixed, closer per
hit: 4bfc −1.6 → −1.7% (plain 773 → 787), d774 +3.7 → +3.8% (plain 365 → 372; the 0.1 pt not looked into);
other: 04d4 (a Purrchena hit fallback → assumed), 4e36 (Si's per-operator total 1.9 → 1.6%). The one-sided gross
(development, earlier, verified, the stage logs and 9c6e aside) 4.70 → 4.15% of a fight before the Barrage Array fix.

**Decisions:** the classification lives in fightTotals' result (TotalsComparison.oneSided), so the totals and the kinds
can't disagree; the hold-outs' kinds only as group means in measure. No engine or kit change (team-ab not needed).
Value-aware slots within a cast (9a80's Si combo final placed on a slash: 6.6%) measured as a scratch count first
(scratch/misslot.ts: mean 0.18% of a fight), not built: one fight carries most of it.

**Left:** cast tails (development 1.9%, hold-outs 2.3%: basic attacks cut by inputs the log doesn't show, a few big
ones), Zhuang Fangyi's Sunderblade count in 4d60, the hold-outs' log-only physical status hits (2.45%), Rossi's
Seething Blood extras, Typhoeus's 5th-shot Hovering ATK (narrowed: no snapshot, the hover's end varies 0.52–0.71 s).

**Problems:** two multi-line `python3 -c` and two heredocs typed from habit (friction report); `zmdlogs totals --all`
can't show one fight's kinds, so the analysis needed a JSONL dump script (scratch/onesided-dump.ts).
