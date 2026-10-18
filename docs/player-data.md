# Reading the owner's account data

Researched 2026-10-18 from community code and docs; no authenticated call
was made. Goal: get the owner's roster, builds (exact gear substats) and
resources without screenshots. There is **no official public API or export**.

## Routes

| Route | Needs | Gives | Risk |
|---|---|---|---|
| **Enka.Network** (`enka.network/ef/{uid}/__data.json`) | UID only; host `enka.network` on the allowlist | Showcased operators only (reportedly 4 slots): operator level, potential, skill levels, talents; weapon level, refinement, breakthrough, gem and its terms; each gear piece's template and artificing level per substat | Low: no login. Undocumented route (Enka documents only GI/ZZZ); rules: custom user agent, never enumerate UIDs, respect `ttl`. |
| **Owner saves SKPORT responses** from the official site in their own browser, with our extension [tools/skport-capture](../tools/skport-capture/README.md) (chosen 2026-10-18) | Nothing on our side | Whatever the official pages load: roster, builds, inventory (see below) | Low: no token leaves the owner's browser. **Don't share HAR files**: they contain the session cookies and headers. Share response bodies only. |
| SKPORT web API called from here with the owner's token | `zonai.skport.com`, `as.gryphline.com`, `web-api.skport.com`; the token | Same data, automatable | **Not recommended.** The token is a full account session; Gryphline's 2026-03-12 security warning says not to authorise logins on unofficial third-party platforms, and the ToS reportedly forbids "unauthorized collection of data from the Services" (§4(a)(iii)(C), second-hand). Reverse-engineered request signing that breaks on updates. |

CN accounts use the same scheme on Skland (`zonai.skland.com`,
`as.hypergryph.com`) and need a device ID.

## What the SKPORT endpoints return

All under `zonai.skport.com`, signed requests (sources: AixLnyt/skport-api-docs,
MR-LORD-REX/endfield, FlamingFox911/endfield-dijiang-optimizer,
FrostN0v0/nonebot-plugin-skland).

- `api/v1/game/endfield/card/detail`: the roster (`chars[]`, apparently all
  owned operators, not only the showcase; not proven to always equal
  `base.charNum`): level, promotion, potential, skill levels, talent nodes,
  equipped weapon (level, refinement, breakthrough, gem), the four gear slots
  and tactical item as **templates** (no substat values). Also account level,
  sanity, battle pass, missions, base. No inventory, currency or stat panel.
- `api/v1/game/endfield/card/char` (one operator): full build including each
  gear piece's **artificing level per substat** (`enhance{attrIndex: level}`)
  and the gem's terms. Values shown by the API are truncated; exact values
  are rebuilt from the game tables (template + artificing level), which we
  have in `data/`.
- `web/v1/game/endfield/team/user-game-data` and
  `calculate/user-game-data` (Team Picks, cost calculator): whole roster
  with `owned` flags, owned weapons with levels, gear and tactical items as
  template ID + owned count (no per-piece substats for unequipped gear),
  material stock (`itemCount`, includes T-Creds). No premium currency seen.
- **No endpoint returns a computed stat panel** (ATK, attributes, crit).
  The engine computes it; in-game stat panels stay useful as checks.

## Open points

- Whether the official game-card page calls `card/char` (i.e. whether the
  owner can capture full builds from the official site, or only via Enka).
- Mapping of `enhance` substat indices to gear substats.
- Operator Showcase slot count.
