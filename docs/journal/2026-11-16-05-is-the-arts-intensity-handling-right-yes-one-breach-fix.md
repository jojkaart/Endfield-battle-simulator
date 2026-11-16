## 2026-11-16: Is the Arts Intensity handling right? (yes; one Breach fix)

Goal (the owner): check the engine's Arts Intensity against the logs and
the data, since `efsim gear --rules` puts Estella on Grizzled Edge
Gauntlets (+3.7%) for their Arts Intensity line. Done (combat-mechanics
§3.7, open-problems "Arts Intensity"):

- **Inventory:** damage × (1 + AI/100) on bursts, reaction hits,
  Combustion ticks (snapshotted), Lift / Knock Down / Crush / Breach hits,
  "Crush DMG" skill hits and Shatter (damage.ts reactionScaleParts /
  statusScaleParts); strength × (1 + 2·AI / (AI + 300)) on Breach,
  Electrification and Corrosion, the applier's AI at application
  (situation.ts artsIntensity, status.ts); no cap; nothing else. The data
  has no coefficient: every reaction value is a ReadSkillSettingData from
  a table not extracted; the stat hint (AttributeShowConfigTable 87)
  lists exactly those three effects (and Lift Stagger), one value each.
- **Logs:** every status hit of the 79 development logs at its replay
  landing (scratch scripts on engineHits / readingBasis). Exact matches
  across AI 0–287 (bursts, reactions), 0–182 (ticks), 0–163 (Lift),
  119–180 (Crush), 0 and 98.7 (Shatter, Estella); no slope of logged ÷
  predicted on AI. Electrification's logged strength exact at AI 0–287.4,
  Breach's at 31–209. The trigger's AI counts (81 reactions where the
  consumed infliction's applier differs), and Shatter's is the shattering
  operator's (a9d7).
- **Fix:** Breach's own hit saw its own new DMG Taken; the logs show it
  sees no Breach, not even the one it replaces (7e19, d4fb, c4f3 exact
  after). Breach hits plain 0 → 7; pogranichnik-chen example 335,507.5 →
  332,358.6; test in tests/kit-pogranichnik.test.ts.

The owner's team doesn't Breach, so its numbers don't move, and the
Grizzled Edge advice stands: Estella's AI is 0 today, and her Shatter,
Solidification and Lift (23% of her damage in the 60 s example) scale
with her own AI in the logs' range. Left open: Pogranichnik's Breach
strength one Fervent Morale layer off the replay in 12 of 21 instances
(the layer's timing, not the curve). In-game test 3 answered by the logs.
