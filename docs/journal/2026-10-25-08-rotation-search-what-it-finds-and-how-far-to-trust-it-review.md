## 2026-10-25: rotation search: what it finds and how far to trust it (review round two)

**Goal:** the round-two search findings: skills hidden by swaps, dead
deadlines in the state key, pruning by macro state, the beam spread,
`resourceWeight`, the silent expansion cap, a full team never searched.

**Done** (design.md "Rotation search"):
- Bug (failing-first test): a swap could nearly always start at the
  state's frame, so `legalActions` dropped every skill that could start a
  few frames later. Swaps are now asides like the dive: choices when
  legal, not counted for what's soonest. 4 of si-laevatain's 14 decision
  states have their soonest action later than the state's frame (Si's
  combo at 190 from 181). Cost: more states judged in full (2.3 → 3.9 ms
  a state on si-laevatain).
- `stateKey(ctx, state)`: past deadlines and casts nothing refers to drop
  out, cast indices count from the end; each field's reads checked (all
  "later than now" comparisons, but a follow-up combo's window count,
  which castSkill reads unchecked: those windows stay). Tests: added dead
  deadlines give the same key and future; 40 pairs a small beam merges
  play on the same. Merges: si-laevatain beam 24 1,533 → 1,701 of ~9,000
  compared, laevatain-solo 76 → 176 (few).
- Pruning keeps one state per family (the same but for who's controlled
  and the buff order) before the rest: in a team the swapped variants of
  one state, all with one score, filled the beam (the 4-operator example:
  12 of 12 nodes at 671,349 when the better rotation was dropped).
- `searchBeams`; `efsim search --beam w` runs w/2, w, 2w, keeps the best,
  prints each and the spread (`--single`: w alone); `capped` and a
  warning when `maxExpansions` cut it; `counts` (compared, merged,
  family, pruned).
- `resourceWeight` / `resourceValues` and `--resource-weight` removed.
- examples/si-laevatain-liino-gilberta.scenario.json: Si, Laevatain (both
  P0), Liino, Gilberta, all ultimates charged, 20 s, the rotation the
  search found (3,701,403). tests/slow/search-beams.test.ts: ratchets.

**Numbers** (single widths 12 / 24 / 48): si-laevatain 2,142,022 /
2,147,903 / 2,064,639 (16: 2,051,398) → 2,094,656 / 2,156,233 / 2,185,220;
laevatain-solo 1,165,844 / 1,194,306 / 1,196,307 → 1,165,844 / 1,165,844 /
1,196,307 (the key's extra merges changed which states the beam kept);
liino-laevatain (after the swap fix) 1,510,467 / 1,514,664 / 1,526,692 →
1,510,467 / 1,402,446 / 1,511,305; the 4-operator example at 6 / 12 (/ 24)
3,016,009 / 1,557,958 (Laevatain never cast her ultimate) → 3,554,349 /
3,701,403 / 3,173,136. Pins: laevatain-solo at beam 8 the same total, 524 →
523 states; the duo at beam 6 264,949 → 247,209 (swap fix) → 269,471
(families; by chance the old key's total). Examples: none moved; one
added.

**Decisions and why:**
- Families, not macro-state caps: capping per (controlled, SP band,
  ultimates ready, combos ready) or per ultimates cast, with or without a
  reserve, moved results both ways (solo 1,165,844 → 1,006,745 at beam
  12, the team still 1,576,033 at 6); families fixed the team's collapse
  and changed nothing for one operator.
- `resourceWeight` removed rather than replaced: at weight 1 it hoards,
  at 0.1–0.3 it helped si-laevatain at beam 12 without families but
  lowered every result with them (liino 1,510,467 → 1,436,660, the team
  3,554,349 → 3,316,409), and its one-cast prices can't value an ultimate
  that enables (Laevatain's ≈ 0). A cheap rollout per node costs about a
  legalActions per step: ten times the search.
- Three widths by default: the spread is the honest answer to "how far to
  trust it", and the best of three is a better answer; `--single` for a
  third of the time.

**Dead ends:** macro-state diversity and resource weights (above).

**Left:** the ranking (damage so far) is what still makes widths
disagree: the beam of 24 drops liino-laevatain's better rotation at frame
198, 13% behind for now; Si's Initial Stroke and Laevatain's ultimate pay
off later. A 4-operator state costs ~26 ms (landing hits: the damage
path and trigger scans, other agents' area). Team rotations swap between
two operators' basic attacks and dive in the air: in-game tests 15 and 97.
