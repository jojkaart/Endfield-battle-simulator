# How operator kits are implemented

Agreed with the owner on 2026-10-18, after the first two kit rounds produced
one-off fields (see [kit-abstractions.md](kit-abstractions.md#3-what-in-the-approach-caused-the-one-offs)).
Kits are implemented in **batches** of operators (with the weapons and gear
sets they use), in phases that repeat until nothing is missing:

1. **Analysis** (per operator, in parallel; read-only). For every mechanic
   of the operator, its weapons and gear sets, decide whether the current
   kit format and engine can express it. Output: a gap report in the format
   below. Nothing is implemented in this phase.
2. **Merge.** Combine the batch's reports into one gap table
   (`docs/kit-batches/batch-N.md`): one row per missing feature, tagged with
   its family and every operator that needs it. Before a gap is called
   unique, check [kit-unique.md](kit-unique.md): if another operator already
   has something like it, it's shared.
3. **Implementation** (per feature family, not per operator): add the
   missing features as shared mechanisms, with tests. Truly unique ones go
   in the operator's own module and on the unique list.
4. **Re-analysis** of the whole batch against the new engine. Back to 3
   until no gap is left, except gaps the owner agreed to defer.
5. **Kits:** write or update the batch's kits (now mostly data), verify
   them against the logs, then the [pattern review](kit-abstractions.md#repeating-the-review).
   Leave out what the loader takes from the compiled SkillData (frames,
   count, events, factor, element, poise, detached, energy, team energy,
   energy blocks: [design.md](design.md#skills-and-buffs-from-skilldata--buffdata),
   "Kits and the game data"); `efsim kit-trim --write` removes what was
   written anyway. A value that differs from the data's on purpose is
   marked where it is, `dataOverride: {field: "reason"}` (the reason says
   why the data's value isn't the game's here: a compiler limit, a branch
   the kit decides, a log that shows otherwise); the loader refuses an
   unmarked difference and a mark where nothing differs.

## Equipment is generic

Any weapon or gear set can be put on any operator (owner, 2026-10-18), and
the simulation must support bad choices: an effect just doesn't activate if
the wielder never does what it needs. So weapon and gear-set effects are
always written as wielder-relative mechanisms (conditions and triggers on
the wielder's own hits, skills, events and stats), never for a particular
operator. Weapons are the exception to "anything goes": an operator can
only equip weapons of its own type (owner, 2026-10-18). The rule comes from
the data (CharacterTable and WeaponBasicTable `weaponType`), not from code,
so a future operator that breaks it just needs its data; loadout searches
offer only allowed weapons, and the engine flags a mismatched build rather
than refusing to simulate it.

## Gap report format

One file per operator, `docs/kit-batches/batch-N/<operator>.md`:

- **Mechanics:** every mechanic, in a table: mechanic (with its source: a
  description quote, or a data file and key), status, and how it's
  expressed (kit field) or what's missing.
  - **Status:** `supported` / `gap` / `data` (the data has it but the kit
    must hand-write it; a compiler gap) / `unique?` (no other operator seems
    to have it) / `unknown` (needs research or an in-game test).
- **Gaps:** one entry each, with:
  - **family:** conditions, values, triggers, buff lifecycle, arts state,
    physical state, timing, skills (states, cooldowns, hitless skills),
    data compilation, log tooling, or *new* (say why none fits);
  - **feature:** what the engine or kit format must do, precisely (fields,
    semantics, when it's evaluated);
  - **evidence:** data file and key, description quote, or log and time;
  - **impact:** what goes wrong without it (wrong damage, illegal or missing
    actions, unverifiable hits), and roughly how much.
- **Verification:** which fixtures can check the operator, and which
  in-game tests would settle unknowns.

Facts taken from earlier reports are marked as claims and re-checked
against the data before they go in a report.

## Deferring

A gap can stay open only by an explicit decision recorded in the batch file
(what it costs in accuracy, which operators it touches). Large ones that
affect many operators (physical statuses, time dilation) go to the owner
first.

## Batches

1. The current seven: Laevatain and the six favourites (Typhoeus, Arcane,
   Si, Gilberta, Liino, Estella), with their weapons and gear sets.
2. The Endministrator and the 4-stars (owner, 2026-10-19: these before the
   5-stars, as complexity seems to rise with power level): the
   Endministrator (chr_0003_endminf in the logs; chr_0002_endminm and
   chr_9000_endmin are the other entries) and Akekuri, Catcher, Fluorite
   and Antal (Estella is in batch 1), with the 3- and 4-star weapons and
   the remaining gear sets ([batch-2.md](kit-batches/batch-2.md)).
3. The 5-stars nearly every player has (owner's request, 2026-10-18):
   Perlica, Chen Qianyu, Wulfgard, Arclight, Xaihi, Avywenna, Snowshine,
   Da Pan, Alesh and Purrchena. Owner (2026-10-18):
   after a few months of active play every player has every 5-star at P5,
   so P5 is the default assumption for 4- and 5-star operators in team and
   loadout searches (a player's own account data overrides it later).
   With the 5-star weapons that have no kit yet and the last two gear sets
   ([batch-3.md](kit-batches/batch-3.md)).
4. The rest (owner, 2026-10-20: "Let's complete the rest of the operators
   now"): the eleven 6-stars without a kit (Ember, Lifeng, Yvonne, Ardelia,
   Last Rite, Tangtang, Rossi, Pogranichnik, Zhuang Fangyi, Mi Fu, Camille)
   and the 41 weapons without one ([batch-4.md](kit-batches/batch-4.md)).
   Owner (2026-10-21): 6-star operators default to P0 in team and loadout
   searches (a player's own account data overrides it), and dive attacks
   are part of rotations (batch-1 S10).
