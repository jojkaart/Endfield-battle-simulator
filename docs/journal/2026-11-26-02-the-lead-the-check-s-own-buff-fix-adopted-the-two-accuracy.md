## 2026-11-26: The lead: the check's own-buff fix adopted, the two accuracy rounds merged

- **Goal:** merge the two parallel accuracy rounds of 2026-11-26 (damage factors; the enemy's clock) and apply what
  the damage-factors round held back because the check was the other agent's file.
- **Merged:** both rounds. The only conflicts were in docs/roadmap.md, docs/roadmap-details.md and docs/tried/README.md,
  where both sides added text; I combined them.
- **Adopted:** the check's loggedEntries now matches an unjudged kit buff's listed entry only against its own game
  buff's engine modifiers. Before, Ember's Pay the Ferric Price was dropped as one of Thermite Cutter's +0.09 layers in
  7e19. The held-back diff is deleted, as docs/tried/README.md says.
- **Scoreboard** (`npm run snapshots:update`):
  - hold-out plain 79.0 → 80.4%, mismatch 5.9 → 5.6%, mean |damage error| 8.5 → 8.4% (3 better, 0 worse);
  - development and verified unchanged;
  - earlier pending's mean |damage error| 4.2 → 4.1%, with 0c14 −4.9 → −3.4% and 7e19 better.
- **Still held back:** the 0c14 diff (Si's away press, hard-coded) and the life-end landings diff (mixed). Both need
  general rules in the replay: an enemy-absent away state, and a hitless press inferred from a buff only its hit gives.
  They are next steps, not adoptions.
