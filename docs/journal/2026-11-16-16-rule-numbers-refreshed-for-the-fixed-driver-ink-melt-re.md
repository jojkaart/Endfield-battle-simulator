## 2026-11-16: Rule numbers refreshed for the fixed driver; Ink Melt re-tuning finds nothing

Goal (the lead): after the rule driver's fixes (one start check, event
stepping), refresh the documented rule numbers, and win back Ink Melt's
−2.4% from zero if a change holds up.

Done:
- `efsim rules --first-seed n` (default 1): the report on fresh seeds.
  The three team pages' "Rules" tables, design.md's results table and the
  example lists' descriptions now give 32 fresh seeds (1001–1032), full
  energy and from zero. The old 10-seed numbers are marked superseded in
  one line. The owner's team: 56,493 / 56,055; Ink Melt: 69,668 / 61,716;
  Typhoeus's: 54,607 / 51,076. Against the fixed 300 s search: +21.1%,
  +27.4%, −3.2%.
- The owner's page: Initial Stroke's +4% was the old driver's. Now
  leaving it out is noise under the data's reading and +2.8% ± 0.6 under
  test 109's alternative (`--assumptions`), so test 109 decides it.
- Ink Melt: neither guided search kept an edit: the default one, judged
  on the zero start too, and one led by the zero start. Nor did a short
  random search. From zero the best edit was noise (+1.2% ± 1.2) and lost
  6.6% at full energy. The example list stays (team page).

Also: the friction report of phase 2
(docs/friction/2026-11-16-phase-2-friction.md).
