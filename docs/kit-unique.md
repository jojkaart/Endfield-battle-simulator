# Operator-unique mechanisms

Mechanisms implemented for one operator only, in that operator's own module
rather than in shared code ([kit-process.md](kit-process.md)). Before
implementing anything as unique, check this list: if another operator (or a
weapon or gear set) has the same mechanism, it becomes shared instead, and
moves out of here.

| Operator | Mechanism | Why unique | Where |
|---|---|---|---|
| Si (chr_0036_jsspsi) | Artful Intent's damage record: while the debuff lasts it records 0.20 × every hit on the target (from the battle-skill hit on, reactions and ticks included), then deals the total as Fixed DMG (damageType 8: no ATK, zones, crit or DEF) | SaveDamageContext and damageType 8 occur only in Si's files among operators (batch-1 Si G2, pass 2 R1); the rule is settled by the fixtures' `uncapped` values | engine (N2): an enemy buff with `records`, `{eventRecorded: true}` in its `buffEnded` trigger, a hit with `fixedDamage`; kit: buff `artful_intent`, trigger `artful_intent_end` in packages/data/kits/operators/chr_0036_jsspsi.json |
