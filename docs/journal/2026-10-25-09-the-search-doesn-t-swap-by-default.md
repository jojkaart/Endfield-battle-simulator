## 2026-10-25: the search doesn't swap by default

The owner: "For now, I don't intend to do operator swaps during battles, so
the default search should not use them either." `SearchOptions.swaps`
(default false) and `efsim search --swaps`: without it the controlled
operator does every basic attack and dive, teammates cast their skills.
The duo pin at beam 6 is 259,112.742 without swaps (269,470.931 with, both
pinned). In-game tests 15 and 97 only matter for `--swaps` now. Examples
(fixed rotations) are unchanged; si-laevatain-liino-gilberta's rotation,
found with swaps, still swaps.
