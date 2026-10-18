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
2. The Endministrator and the 4- and 5-star operators nearly every player
   has (owner's request, 2026-10-18). From CharacterTable: the
   Endministrator (chr_0003_endminf in the logs; chr_0002_endminm and
   chr_9000_endmin are the other entries), the 5-stars Perlica, Chen
   Qianyu, Wulfgard, Arclight, Xaihi, Avywenna, Snowshine, Da Pan, Alesh and
   Purrchena, and the 4-stars Akekuri, Catcher, Fluorite and Antal (Estella
   is in batch 1). Fifteen operators: to confirm with the owner which of
   the 5-stars count as ones everybody has.
