# Gear from the logs

Part of the [design](../design.md): Choosing gear from the loadouts seen in the logs.

`efsim gear <scenario.json>` (packages/cli/src/gear.ts, 2026-11-15; the
owner: different teams do best with different gear, so try every common
setup). Until a real gear search exists, it picks each operator's gear
from loadouts players actually run:

- **Candidates** per operator: the scenario's own loadout; the distinct
  loadouts (four piece IDs as logged) in the log fixtures (fixtures/,
  pending/, multi-target/; hold-out logs live in fixtures/holdout/ and
  are never read: they're only measured), seen at least `--min-count` times (default 2), at most
  `--top` (default 6), ordered by how many of the scenario's teammates
  the log also has (the whole team first), then by count; and loadouts
  from `--candidates file` (`{"candidates": [{operator, gear, source}]}`:
  guide sites, screened logs not imported), each citing its source. One
  loadout from several places is one candidate with every source.
- **Score**: the scenario's rotation replayed with only that operator's
  gear swapped (pieces at full artifice; the scenario's own loadout as
  it is). Where steps of the rotation can't be played with it (a
  finisher whose Stagger now comes later, a combo whose window didn't
  open, an ultimate whose energy now comes later: EngineError), the
  **repaired replay** (2026-11-15): the rotation played in order from the
  state the kept steps left, each step that fails started at the first
  of 0.33–2 s later that works, else kept waiting and tried before each
  later step (an ultimate's energy may come from them), else up to 15 s
  after the last step, else dropped; if at most `--repairs` (default 20)
  steps fail, it's scored against the current loadout's replay: a lower
  bound for the candidate, which plays a rotation made for other gear
  late; taking it takes that rotation. Why (the owner's team): its
  rotation hinges on Stagger and energy timing, so almost every other
  Akekuri, Si or Estella loadout moved Estella's finisher past the
  Stagger or Si's second ultimate past its energy, and the narrow
  searches, 20–30% under the beam-48 skeletons rotation, decided the
  whole ascent: a +0.1% searched "gain" for Akekuri swapped the rotation
  and every later score was on the weak one (−17% overall). With repairs
  the ascent stays on the owner's rotation. A moved or dropped step can
  make later ones fail too (Si without her Ultimate Gain gloves: 2 steps
  later, 5 dropped), so a repaired score can be far below what a rotation
  made for that gear gets. With more failing steps, a
  narrow search (`--search-beam`, default 12, no macros) gives its score instead,
  compared with the current loadout's own narrow search, never with a
  replay (a first version compared them directly: a beam-6 search's
  rotation beat the beam-12 one it was compared with, and a loadout won
  for the search's sake). Narrow searches are noisy (two beam-6 searches of
  one team differed by 50% from zero energy), so a searched winner wants
  a proper search of its own before it's trusted; taking a searched loadout takes its search's
  rotation too. A replayed score favours the gear the rotation was
  searched with, so a candidate's total is a lower bound for it.
- **Coordinate ascent**: each pass takes every varied operator's best
  candidate with the others fixed (ties keep the current one), until a
  pass changes nothing (`--passes`, default 4). `--keep <operator>` holds
  one fixed (the owner's Arcane); for an operator whose mode two
  attributes decide (Arcane's Intellect / Will), the kept operator's
  candidates are listed with the pair, to see which would change the mode.
- **Output**: a table per operator (each candidate, sources, logs by
  teammates, team total, against the chosen one); `--out` writes the
  scenario with the chosen gear and the rotation (repaired or searched
  where a chosen loadout took one). A full search with the chosen gear
  comes after (it may find a better rotation for it; on the owner's team
  and Ink Melt, 2026-11-15, the searches with the new gear found less
  than the old rotation replayed with it: the search is chaotic, a small
  change in the team sends the beam elsewhere, so keep the better of the
  two).
