# Batch 2: the Endministrator and the 4-stars

Owner (2026-10-19): the Endministrator and the 4-star operators before the
5-stars, since complexity seems to rise with an operator's power level.
The 5-stars are batch 3.

Operators: the Endministrator (chr_0003_endminf, the playable one;
chr_0002_endminm and chr_9000_endmin are the other entries: the analysis
says whether they need a kit of their own), Akekuri (chr_0019_karin),
Catcher (chr_0020_meurs), Fluorite (chr_0022_bounda), Antal
(chr_0023_antal). Estella, the fifth 4-star, was in batch 1.

Equipment that nearly every player has, each with one owner (the operator
whose report covers it):

| Owner | Weapons (3- and 4-star) | Gear sets |
|---|---|---|
| Endministrator | wpn_sword_0003 Tarr 11, wpn_sword_0008 Prominent Edge | suit_crush_fracture Grizzled Edge, suit_attri01 Bonekrusha, suit_str01 Armored MSGR |
| Akekuri | wpn_sword_0009 Wave Tide; lances (no batch-2 lance user): wpn_lance_0009 Opero 77, wpn_lance_0003 Pathfinder's Beacon, wpn_lance_0008 Aggeloslayer | suit_atb01 Frontiers, suit_combo_cd01 Qingbo, suit_agi01 Roving MSGR |
| Catcher | wpn_claym_0010 Darhoff 7, wpn_claym_0003 Industry 0.1, wpn_claym_0009 Quencher | suit_poise01 Æthertech, suit_stragi01 AIC Heavy, suit_criti01 MI Security |
| Fluorite | wpn_pistol_0001 Peco 5, wpn_pistol_0002 Howling Guard, wpn_pistol_0003 Long Road | suit_expend_spell01 Xiranflow, suit_generaltype AIC Fieldwork, suit_atk01 Aburrey's Legacy |
| Antal | wpn_funnel_0002 Jiminy 12, wpn_funnel_0001 Hypernova Auto, wpn_funnel_0003 Fluorescent Roc | suit_pulse_cryst01 Pulser Labs, suit_will01 Mordvolt Resistant |

With these, every gear set in the game has a kit (batch 1 wrote the other
eight).

Phase: **kits done (2026-10-19)**; open items below. Shared features done: L1, B4, D4, S2, S4, V2, B2, D1, D2 (group 1); T1–T6, C1, C2
(group 2); V1, B1, B3, S3, S5, S6 (group 3); E2; S1 (jumps skip time: the
data's unconditional ones, conditional ones by `KitSkill.jumps`, event-driven
ones by a trigger's `jump`; InterruptCurSkillAction ends the action); E1
(enemy attacks and charges; dodges with a success chance, perfect dodges
from BuffData; [design.md](../design.md#damage)). Open: D3, V3.

**Kits done (2026-10-19):** the Endministrator (one kit for chr_0003_endminf
and chr_0002_endminm), Akekuri, Catcher, Fluorite and Antal, with all 27
equipment kits of the table above; each report ends with a "Kit
(2026-10-19)" section (re-analysis per gap, verification, proposed in-game
tests). Fluorite's 56 logged hits all match (fixtures/pending/
zmdlogs-abfd4b7478ec.json, whose builds were corrected from the log's own
data); the Endministrator's 34 are covered but off by an unlisted team aura
and +180 flat ATK of unknown source (pending/zmdlogs-7e19489ae503.json).
Akekuri, Catcher and Antal have no log yet. Pattern review:
[kit-abstractions.md](../kit-abstractions.md#review-after-batch-2s-kits-2026-10-19).

Open after the kits, each with an interim in the kits:

| ID | Feature | Needed by |
|---|---|---|
| K1 | **Done** (`KitTrigger.chance`): a trigger that fires with a chance (BuffData `Probablity`), rolled on its own seeded stream | Antal and Fluorite talent 2, `buff_equipsuit_magicinfdb_01/_02`, Laevatain's combo knock-back |
| K2 | **Done** (7c7d00e): a buff a trigger applies takes its values from the situation at the event | Endministrator (Grizzled Edge) |
| K3 | A physical status's own damage where the game deals it (Lift, Knock Down, Crush before the applying hit's damage; Breach after) | Endministrator (Crush: 12–17%) |
| K4 | **Done** (`teamEnergy[].detached`; Fluorite's at frame 99): a team-energy part that outlives its cast | Fluorite (explosion at frame 99) |
| K5 | **Done**: SP grants take their kind from the data (atbGainMethod), the `sp` event says natural or refund, with a `natural` filter (V3) | Akekuri P1, Frontiers |
| K6 | Log tooling: the finisher multiplier in `zmdlogs check`; `zmdlogs reactions` and conditions on the enemy's state; enemy-side team auras tried with and without | Fluorite's and the Endministrator's logs |
| K7 | Unknown: +180 flat ATK on the Endministrator in 7e19489ae503 | in-game test (her stat panel vs `efsim calc`) |
| K8 | Covered by the dodge model: a missed dodge is an ordinary hit with no dash, and a perfect dodge replaces the attack (no `attacked` event) | Antal and Fluorite talent 2 |
Reports: [batch-2/](batch-2/), one per operator, each ending with a kit
plan whose draft kits were loaded with the real loader.

| Operator | Rows | Supported | Gap | Data | Unknown | Unique? |
|---|---|---|---|---|---|---|
| Endministrator | 44 | 35 | 3 (+4 format) | 2 | 4 | 0 |
| Akekuri | 42 | 28 | 5 | 5 | 2 | 0 |
| Catcher | 38 | 22 | 9 | 4 | 3 | 0 |
| Fluorite | 44 | 32 | 7 | 1 | 4 | 0 |
| Antal | 35 | 24 | 5 | 1 | 1 (+3) | 0 |

Nothing is unique. The Endministrator: chr_0003_endminf and chr_0002_endminm
are one kit under two IDs (same values and frames); chr_9000_endmin is the
virtual character that holds their talents and potentials, not playable.

## Owner's decisions (2026-10-19)

- **Enemy attacks come from the scenario.** A scenario lists when the enemy
  attacks the team (times, or every N seconds; default none), and "when
  attacked" effects fire then: Catcher's counter-bash, combo trigger and
  P5 SP, Fluorite's talent 2 (and in batch 3 Snowshine, Ember, Purrchena).
  Real boss patterns can come per enemy later.
- **Perfect dodges** (2026-10-19): they can only be done against an enemy
  attack, and they freeze the battle's time except some timers such as
  skill cooldowns. The simulator runs with and without them, and with a
  chance that a dodge succeeds, to simulate a less skilled player (rolled
  with the same seed as crits, so many runs show its effect on the spread).
- **Crits are rolled, and the spread is reported.** Damage with crits is
  variable, so the simulator needs both a single battle with rolled crits
  (crit-triggered effects such as MI Security's fire on real crits) and the
  variance of a rotation's damage, not only its expected value.

## Merged gaps

Report references are `operator Gn`.

| ID | Feature | Needed by |
|---|---|---|
| E1 | Enemy attacks from the scenario: an `attacked` event (whom, when), also an enemy charging a skill; a dodge action possible only against an attack, and a perfect dodge's time freeze (owner, 2026-10-19: it freezes the battle but not some timers, such as skill cooldowns, as the engine's time stops do) | Catcher G1, Fluorite G5, every operator's dodge |
| E2 | Rolled crits with a seed, crit events for triggers, and many runs for the damage's mean and spread | Catcher G6 (MI Security) |
| T1 | A Stagger Node event (the enemy's `staggerNodes`) | Akekuri G1 |
| T2 | An "SP recovered" event | Akekuri G5 (Frontiers) |
| T3 | A combo's application taken from the event that opened its window (`element: "event"`, `status: "event"`) | Antal G1, Fluorite (combo), Arcane A6 |
| T4 | A triggered hit lands before the trigger's later actions | Endministrator G2 |
| T5 | Every trigger on one event is judged on the situation at the event | Endministrator G4 |
| T6 | An enemy buff from anyone by game buff ID: predicate and `buffApplied` filter | Endministrator G3 (Grizzled Edge; batch 3: Grand Vision, Glorious Memory) |
| C1 | A buff modifier that holds only against a target in a state (`if` judged per hit) | Fluorite G1 (talent 1, Slow), Typhoeus's combo debuff |
| C2 | "The operator has a buff of a zone" (the operator-side twin of `enemyModifier`) | Antal G2 |
| V1 | A hit whose base isn't ATK (300 + 5 × DEF) | Catcher G3 (P1) |
| V2 | `floor` and division in values; attributes including buffs | Catcher G4, Akekuri G6 |
| V3 | Natural vs returned SP for kit SP grants | Akekuri G3 (every kit; in-game test first) |
| B1 | Link stacks from a kit buff | Akekuri G2 (talent 2) |
| B2 | A buff action that adds several layers (`layers`) | Fluorite G4 (Xiranflow) |
| B3 | Layered buffs with one shared, refreshed timer (BuffData stackingType 8) | Catcher (Æthertech, MI Security), Akekuri P1 (U3) |
| B4 | ATK as a kit-buff attribute is silently ignored: map it or refuse it | Fluorite G7 |
| S1 | Jumps in a skill's timeline (Ti3) and a skill ending itself | Catcher G2 (her data only makes sense if jumps skip time), Laevatain R1, Liino R5 |
| S2 | Cooldown attributes (attribute 47, cooldown ×) | Akekuri G4 (Frontiers, Qingbo) |
| S3 | Alternative chain steps by timing (attack4 / attack4_1) | Fluorite G2 |
| S4 | A step without `at` waits for the current cast's delayed actions too | Fluorite G3 |
| S5 | A skill's team energy in parts, one conditional | Catcher G5 |
| S6 | The action gate sees an `endAction` that's due (batch 1's open item) | Catcher, Liino |
| D1 | The gendered Endministrators' talent values come from the virtual character | Endministrator G1 |
| D2 | One kit for two operator IDs (`variants`), and chr_9000_endmin hidden | Endministrator G7 |
| D3 | Compiler leftovers: per-hit element, projectile routes and jump branches as alternatives, poise, finisher factors, SP keys | Akekuri G7, Antal G3, Fluorite G6 |
| D4 | The build format allows weapons with two skills | Fluorite G8 (Peco 5) |
| L1 | Crush hits are logged as `buff_physical_crushed` | Endministrator G5 (53% of her logged damage) |

Proposed to defer (no effect on bosses or on damage): the Endministrator's
seal freezing enemies with super armor below 20 (G6); kills and HP (N1:
AIC Heavy's heal on kill, Catcher's combo below 40% HP).
