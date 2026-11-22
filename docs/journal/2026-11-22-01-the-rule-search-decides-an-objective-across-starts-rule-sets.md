## 2026-11-22: The rule search decides: an objective across starts, rule sets, setups

**Goal:** the owner: "The whole point of this simulator is to discover [the rules] for each team." Three rule
questions had been left as the owner's call because the guided search had no objective across the fight's two starts
(full energy, the zero-energy companion). Later the same day, also from the owner: conditionally active rule sets, so a
team with Arcane and a non-Nature inflicter can play a Corrosion setup phase.

**Done** (docs/design/rules.md "The objective across starts", "Rule sets", "The search decides"):
- **The objective:** every list played on both starts on the same seeds, each seed scored by the two starts' mean
  sustained DPS (`startsObjective`); the guided search's default (`--objective mean`; `first` the old veto), per-start
  gains in its report, `efsim rules --compare` the same. Chosen over one long fight from zero because both starts
  happen in play and a fight from zero never returns to four full bars.
- **Cues:** `ultimates` (how many ready at once, rank 4), `energy` (an ultimate's gauge, rank 5), `statusLevel` (a
  status at a level, rank 3: Corrosion at full strength is level 4). In guideCues, the rule search's pool and its
  threshold moves.
- **Rule sets:** `sets: [{ name, when }]` and a rule's `set`; one ordered list, a set rule read only while its
  condition holds (`effectiveRules`); the condition counts once in the learnability; flat lists unchanged.
- **Search moves:** reaction setup sets (`reactionSetupEdits`: the applier at 4 stacks of another element, else the
  inflicter, from spare SP or not, with the list's own guards), rules moved between sets (`setMoveEdits`), an edit
  split by a start cue into two sets (`splitEdit`, after a round that keeps nothing or a kept edit that disagrees
  between the starts), the rule search's `editSets`.
- **Searches** (with-lock, 15–49 min each): the owner's team kept a Corrosion setup set: +1.06% ± 0.33 on 64 fresh
  seeds with Akekuri's ultimate guard (+1.71% as found; Arcane's press alone +0.94%). Ink Melt: Laevatain's ultimate
  waits for Corrosion, Si's for Combustion and Twilight: +3.21% ± 0.73 (64). Typhoeus's: ultimates wait for the hover,
  Arcane's battle skill while the Stagger bar is below half: +8.62% ± 0.65 (32). Questions: Estella on Stagger no; Ink
  Melt's rule 7 `shows` no (a loss from both starts now); the Twilight hold kept (dropping it −2.3%). Arcane INT
  (Hot Work), each mode with its own searched list: −1.91% ± 0.60 (64): not worth farming. Examples changed; an INT variant in examples/variants/.

**Problems:** the 2026-11-16 numbers behind the questions had all moved (the engine changes since): measured per start
before designing anything. The owner's setup as found pressed Akekuri's battle skill inside her ultimate; the rules
check in the test suite caught it, the setup move now copies the list's guards. The first INT search hit the 2 h
background limit (queue wait included): rerun with 4 rounds from the new WILL list. `npx prettier` reformatted a file
(no config in the repository): rebuilt from `git show HEAD`. Friction: docs/friction/2026-11-22-rule-objective.md.
