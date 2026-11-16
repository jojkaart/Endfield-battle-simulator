## 2026-10-25: kit conditions and `--condition` removed

**Goal:** the owner's "yeah, remove it": no kit defined `conditions` since
kit buffs and `--buff <id>[:layers]` replaced them. **Done:** the
`Condition` type, the kits' `conditions`, `DamageOptions.conditions` and
its helpers, the scenario option, the schemas' fields and the CLI option
(32 files, −506 / +180 lines). No number moved; the loaded-kits snapshot
was regenerated because every kit carried an empty `conditions` (the kits
are otherwise byte-identical). `activeConditions` (talent and potential
modes) is a different thing and stays. Also the owner's call on
same-frame hits of two operators: too rare to matter, no in-game test.
