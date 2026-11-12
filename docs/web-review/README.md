# Engine rules against web sources (2026-11-12)

The owner's method: the engine's rules in one list
([../engine-rules.md](../engine-rules.md), 215 numbered rules), a scout
for sites with combat mechanics, then one comparison per source, and
differences that independent sources share are tested. Reports: one file
per source here. Small-model reports: claims to check, not findings.

## Sources and how independent they are

| Group | Reports | Basis |
|---|---|---|
| 666bj | [666bj.md](666bj.md); End-DPScope's research (DP-) is a copy of it | in-game tests (NGA), the most independent |
| Talos Wiki | [talos-formula.md](talos-formula.md), [talos-mechanics.md](talos-mechanics.md) | data tables, tooltips, community |
| EndfieldHub, Datafield | [datafield-hub.md](datafield-hub.md) | EH credits the Talos Wiki, Prydwen, Game8: not independent of Talos |
| Zero Sanity | [simulators.md](simulators.md) (ZS-) | its own in-game tests for some values |
| Endaxis | [simulators.md](simulators.md) (EA-) | data reading (buff rules) |
| GameKee | [gamekee.md](gamekee.md) | Chinese community (Bilibili authors) |

Not reachable from here (owner: allowlist if wanted): endfield.pages.dev
(guides on formula, reactions, Stagger), www.prydwen.gg; ngabbs.com and
endfield.huijiwiki.com block automated requests themselves.

## Differences that several groups share

| # | Rule | Engine | Sources | Groups | Already known | To test |
|---|---|---|---|---|---|---|
| 1 | A36 | Solidification 5.75 / 6.75 / 7.75 / 8.75 s | 6 / 7 / 8 / 9 s: 666bj, DP, EH, ZS | 3 | OPEN (test 71) | logs: Solidification's end (Shatter, listed status) |
| 2 | K1 | SP regen paused 1.5 s after every spend | 0.5 s after a battle skill (666bj, tested; DP); 0.5 s only after a perfect dodge (Talos) | 2 | OPEN (B2, test 102) | logs: SP-limited cast spacing |
| 3 | S11 | Stagger nodes: an event, no damage effect | ×1.3 for 2.5 s at 33 / 66% (EH); frailty 5 s (ZS) | 2 | DATA | logs: hits just after a node |
| 4 | A37, S8 | Solidification and Stagger don't control the enemy | they can't move or act (Talos, EH) | 1–2 | — | logs: enemy-clock timers during Solidification |
| 5 | P6, S3 | Lift and Knock Down deal no Stagger of their own | 10 each (666bj, DP, Talos, EH, DF; EH: × (1 + AI/200)) | 3 | SETTLED by logs (155 of 156) | recheck: forced Lifts, Vulnerable targets, the one exception |
| 6 | P4, P5 | Lift 3 s, Knock Down 10 s (status) | 1 s (Talos, ZS) | 2 | DATA | what reads the status's length |
| 7 | K31 | Link 15 s | 20 s (ZS; Lifeng's combo data), varies by source (Talos), one hit (EH), decays (GameKee) | 3, disagreeing | Lifeng kit review, test 78 | test 78 |
| 8 | T18 | perfect dodge +7 SP | 7.5 (Talos, DP) | 2 | OPEN (test 52) | test 52 |
| 9 | D26 | Weakness and Protection ×1 | in the damage chain (Talos, ZS, DP: attacker side) | 3 | ASSUMED | only matters if something applies Weakness to an attacker |
| 10 | A22 | Combustion ticks keep ATK from the application | read at each tick (EH, DP) | 2 | SETTLED by logs (test 77) | none: the logs settled it |

Single-source items with some weight: 666bj's enemy damage-reduction zone
(shields −90%, prism-linked −80%: D28 silent), its quick re-Stagger
halving (S10 silent); GameKee's order of a reaction's own hit before the
triggering hit (A16); ZS's Stagger fixed at 5 s (S9; the data's attribute
21 says 6–24 s); Talos's attributes unfloored (D10, against the settled
5871 ATK). Self-contradicting or weak claims are in the reports.
