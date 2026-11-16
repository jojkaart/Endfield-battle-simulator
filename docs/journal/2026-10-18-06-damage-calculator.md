## 2026-10-18: damage calculator

**Goal:** something usable: the stat panel and damage per hit of a build,
verified in game.

**Done:**
- Loaders and cross-checks for growth, potentials, weapons, weapon level
  curves, gear, gear sets, enemies and attribute defaults (all agree between
  the sources); English names; blackboard defaults and permanent stat
  effects (`cardAttributeModifier`) from skill files.
- Engine: attribute enum map, stat aggregation with contributions, damage
  zones, crit modes, conditions. Hand-written kits (hit structure only,
  schema-checked, keys cross-checked against SkillData) for Laevatain and
  Forgeborn Scathe's conditional buff.
- Fixture format (JSON Schemas) and the Zero Sanity Laevatain fixture: 10
  stat panel values and 25 hits, **all exact** from game 1.6 tables.
- `efsim` CLI: find, template, calc, compare. 105 tests.

**Findings / decisions:**
- Formula slots: 5 add, 6 percent, 7 flat, 8 multiply; final =
  ((base + add) × (1 + percent) + flat) × multiply. 5 and 6 verified in
  game; 7 and 8 from data patterns. Slot 0 appears once and is refused.
- ATK bonus uses whole attributes (settled); final damage rounds to nearest
  (settled). Laevatain's level table now runs to 99.
- Potentials change skill values by add / multiply / set; which hits a
  value like `ratio` multiplies is in SkillData's action graph, so kits
  encode it, verified by fixtures (P1's ratio applies to the enhanced
  battle skill, not the normal one).
- Skill levels follow CharGrowthTable's skill groups (enhanced basic
  attacks use the ultimate's level but the basic attack damage bonus).
- Some tables store doubles (potentials 0.15), others float32; values are
  kept as written.
- Code must be erasable TypeScript (`erasableSyntaxOnly`) so Node 22 runs
  it directly; no build step.

**Problems:**
- Projectile and ability-entity hits link to their parent skill only by
  file name; rmxlinux has no ProjectileData.
- Conditional effects aren't modelled generically yet, so weapon
  comparisons understate weapons whose strength is conditional; `compare`
  lists them.
