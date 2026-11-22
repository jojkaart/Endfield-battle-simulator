## 2026-11-22: Gilberta's Vulnerable count, Zhuang Fangyi's Empyrean entity keys

**Goal:** two accuracy leads: the replay's Vulnerable count one or two low at Gilberta's ultimate (4360, 489c, 9847,
d572; her Susceptibility is 0.30 × (1 + 0.1 × stacks)), and Zhuang Fangyi's `attack1_ult_2_abilityrange`, a logged key
no kit hit named (32 unplaced groups), with her d774 Sunderblade lead.

**Zhuang Fangyi (data):** Empyrean attacks 1 and 2 each spawn four entities `attack1_ult_1..4_abilityrange`, cylinders
at their own offsets; each hits only without the 0.4 s marker the one that hit leaves, so one hit per attack, logged
under whichever entity held the target (_1, _2, _3 all in the logs). Both kit hits name the four keys. The two attacks
then share every key; the placement told them apart by kit order only (attack 2's hits read ×1.4), so `choose` now
picks, for steps alike in every key, the one whose window of the latest cast lies nearest, past a skill that keeps the
chain (her Empyrean battle skill). A first, general version moved Ardelia's, Typhoeus's and Rossi's casts in five
logs: restricted to steps alike in every key. **The Sunderblade lead was a misreading:** d774's battle skill at 97.24 s
has all 8 strikes, the last 3 and the final after her ultimate's stop (her ultimate is logged at its end, 102.17 s;
4d60 157.42 s the same). Her strikes come from a buff on her, so her own stop holds them: a skill hit can now be on the
world's clock (`KitHit.world`, as trigger hits could); her Empyrean strikes (an entity's) keep their pace through her
own combo slow-down in 4bfc and stay on hers.

**Gilberta:** in 489c and d572 the replay landed Rossi's combo 3 twice: the late path's hit (the kit's jump 0 → 212
without the ring) and the logged perfect hit pinned 14 frames later; the late one consumed the infliction the perfect
one's Lift and extra Vulnerable need (+1 where the game gave +2). The replay now drops a jump that would skip a pinned
landing of a hit only the skipped part has (not Pogranichnik's combo, whose slashes land on both paths: a first version
cost c4f3 17 plain hits), with its path; that also ends Rossi's attack 4 landing its controlled and uncontrolled hits
both (2fd9, 99fb). Then 9a80's perfect hit lost its consumption to Gilberta's ultimate landing in the same frame first
(by operator id): pinned landings of a frame now land in the log's order (`loggedMs`). The four ultimates read 4 as
listed; 18 of the 21 listed ultimates agree. **Open:** 4360 and 9847 (tower bosses), where the stacks outlive 20 s by
0.4–1.6 s of world time (open-problems.md, with what's ruled out).

**Numbers (scoreboard):** development plain 52.0 → 52.1%, mismatch 18.2%, damage error 12.6 → 12.4%; earlier pending
plain 48.9 → 50.2%, damage error 8.3 → 8.6%; hold-out plain 67.3 → 67.5%, mismatch 6.7%, damage error 12.1 → 12.2%;
verified 4e5e −1.7 → −3.8%. d572 plain 655 → 788. The totals that fall (4e5e, 4a64, 2fd9, 99fb, 489c, 0c14) lose
phantom "replay only" hits of Rossi's (late, hit_ai) that the log doesn't have; d774 and c6d8 rise as her Empyrean hits
now land (d774's ×1.39 strikes from 97.87 s not looked into).

**Also:** census's rerun line prints `--window=a,b` (a negative window failed as printed).
