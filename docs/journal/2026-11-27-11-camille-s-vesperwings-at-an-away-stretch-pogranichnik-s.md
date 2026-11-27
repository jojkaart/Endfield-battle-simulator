## 2026-11-27: Camille's Vesperwings at an away stretch, Pogranichnik's harasses

**Goal:** two leads from docs/open-problems.md: e989's Camille Firefang Weakness (fire Susceptibility 0.12) the replay
kept on 69.19–89.32 s, and Pogranichnik's harasses 0.2–2 s off in his five logs.

**Camille.** The debuff is a child of the hovering Vesperwings entity (autoFinishByAction); the entity checks its
target every 0.5 s (buff_chr_0033_camille_normal_skill_bat_checktarget: FindTargetAction, CheckEntityNum,
FinishOwnerAction unless retargeting) and finishes without one. Every other Camille run ends at a refresh, a kill or
the fight's end; only e989 has an away stretch, and it lists the debuff to 19.67 s (the first stretch's start: no purge
is read there, the stretch being longer than PURGE_GAP_MS) and to 69.19 s, 1.74 s before the stretch 70.93–84.83 s, at
a check's boundary (61.69 s + 15 × 0.5 s). Si's boss leaves as the damage reaches about 50% and 85% of twice its Max HP
(scripts/probes/entities/jsspsi-phases.ts), the second time 0.2–3.6 s after the share is dealt, still hit meanwhile.
Built: KitBuff.targetCheck (`every`, `assumption`), read only by the log check's replay (buffreplay.ts targetLosses,
lostTargets, composed into `held` after the purges), behind Camille's kit assumption `vesperwings-target-loss`:
`kept` (as before), `away` (the first check after the stretch's last logged hit), `listed` (the check at the debuff's
last listing within TARGET_LOSS_LEAD_MS, 4 s, before the stretch; default). Measured: `listed` e989 plain 260 → 267,
|damage error| 0.5 → 0.1%, its 86.65 s Heat burst paired; `away` mixed (264, 0.8%); one hold-out better under both
(mean |damage error| 6.4 → 5.8%). Why a kit assumption: the engine registry is in timeline/, the parallel agent's
folder (friction report point 2).

**Pogranichnik.** The harass entity slows itself at each path's frames 0–3 (TimeDilationAction layer 1, 0.4 s, an
inline curve 0.30 → 0.043 → 1: mean scale 0.23, scripts/probes/entities/harass-slowdown.ts), so its frame-9 hit comes
9.24 frames late; as an entity's timeline it is on the world's clock, which his own combo's slow-down holds (d4fb's
Breach at 86.67 s, its harass at 87.97 s across his combo from 87.20 s). Kit: frames [18], `world`. Over his five logs
(scripts/probes/entities/harass-deltas.ts) median |Δ| 299 → 88 ms, one-sided 37 → 21; frame 17 measured worse (119 ms);
the teleport takes no time (ruled out). d4fb's 87.97 / 88.55 s harasses now pair right. The Decisive Assault stays at
frame 25: every logged one comes 0.21–0.44 s after its event, which nothing in the data gives (frame 8 fits all but
two; not built: open-problems "The placement cases the one-sided rounds left").

**Numbers** (snapshots:update, docs/accuracy.md): development plain 84.2 → 84.3%, |damage error| 1.3%; hold-out plain
82.5%, mismatch 5.3 → 5.1%, mean |damage error| 6.4 → 5.8%; earlier pending plain 82.2 → 82.3%. Better: e989, c4f3,
7e19, d4fb, de6a and one hold-out; mixed: a9d7 (plain 332 → 336, damage −1.7 → −1.8%, per-hit error closer); worse:
none. Team fights unchanged (team-ab identity at e2e6f3f: no team example has either operator); the
pogranichnik-chen example snapshot moves with the harass frames.
