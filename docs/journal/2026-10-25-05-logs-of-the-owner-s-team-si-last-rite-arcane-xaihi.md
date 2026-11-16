## 2026-10-25: logs of the owner's team (Si, Last Rite, Arcane, Xaihi)

**Goal:** the owner asked about Xaihi's weapons and rotation in their
team, then for logs of that team. **Done:** three ZMDLogs battles found
by intersecting the four operators' character profiles, imported to
`fixtures/pending/` (b6aa15281db4, 9555de54bb3d, c3c735dbb022) with
first check results and notes (pending README). **Finding:** in b6aa
the player swaps, and one Last Rite battle skill gives one Mirage pair,
not one per member as her kit's `mirage` has it (G4, in-game test 83).
Kit unchanged. **Coordination:** the session rewriting the log check
owns `tests/snapshots/` and merges this branch into main after its
rewrite, regenerating the verdict snapshots (so `npm run test:logs`
fails on this branch until then), and reports what its engine-first
check says about the Mirages before anyone changes the kit. Two more
candidate battles (34aae9073643, 4b2245b45146) returned 504 and can
wait.
