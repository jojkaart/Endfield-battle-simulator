## 2026-11-26: What ends Arcane's Doubles Susceptibility: the slug's purges, e82d's second touch

**Goal:** the lead from docs/journal/2026-11-26-12-arcane-s-will-lines-and-chen-s-late-wolven-blood-final.md: Arcane's
combo Susceptibility (`doubles_susceptibility`) gone before Si's combo final in e82d (8.93–9.12 s) and 6339 (29.38 s),
which the replay keeps; find what ends it in the data, check it on every Arcane log, implement, measure.

**Done:**
- **Every run of it, every Arcane log** (scripts/probes/kits/arcane-doubles-runs.ts): in WILL each run ends at its
  seal's tick, 6.1–7.6 s of world time, but four. **6339's two and 7b54's at 47.48 s aren't Arcane's:** every team
  debuff on Hard 33's slug ends at the same logged moment (Jade Vessel, Camille's Susceptibility, Arcane's weapon
  lines), and in 6339 every hit after 11.27 s read exactly with the log's listing, the replay's 1.40 times the logged.
- **Engine assumption `logged-purges`** (default `log`; packages/logs holdinputs.ts loggedPurges, purgedByLog, wired in
  buffreplay.ts): a logged moment after which none of the team's runs on the enemy listed there is listed again, at
  least 3 debuffs (a debuff's per-element affixes once) from two operators, the next moment within 1.5 s: the replay
  ends every enemy-side kit buff, status, infliction, Vulnerable stack and control there, and drops an Arts Burst on
  its way (6339's replay-only burst at 29.40 s had put Arcane's Solemn Phalanx line on every later hit). Only 6339's two
  moments qualify among the development logs. Scoreboard: development plain 73.8 → 74.3%, mean |damage error| 6.1 →
  5.1%; 6339 plain 28 → 112 of 140, +40.8 → −8.0%; verified, hold-out and earlier pending unchanged.
  tests/logged-purges.test.ts.
- **e82d is the only second touch inside a running seal in any log** (multi-target included;
  arcane-second-touch.ts): only the Doubles Susceptibility goes, the first run's listing ending where the second's
  begins. Ruled out: Si's Immobilization (seals applied while she holds the enemy run their full length:
  arcane-doubles-immobilization.ts), Si's Initial Stroke (0eef inside a run), Rhodagn's Stagger node (bar 225), the
  seal's early end by abilityEvent 8 / 1403 / 1601 (it casts abilityentity_end, logged as a combo cast; none),
  its tick. Open: the second application refreshing the first instance, which ends with the first seal at the second
  touch's InterruptAction (87 ms before the last inside listing: the log's batching), or Arcane's passive's
  TagQueryListener. Not implemented: one hit in one log.

**Decisions:** a log-read stage event, not a kit rule: no data names the slug's phases, and the purge's evidence is the
log's own listing (as the logged Stagger steps are). Statuses and inflictions go too (the burst decided it: without
them 6339 kept 35 mismatches). The affix pair counts once because 3aa6 at 25.42 s (Arcane's pair and Perlica's
Electrification) read as a purge otherwise and lost 26 plain (earlier pending). The −8.0% isn't worse than +40.8%: the
over-prediction had cancelled Si's low combo-final slots at 11.31 s (the slug's HP cap). No team-ab: no kit or
engine rule simulations read changed.

**Left:** e82d −8.9% (a log with a second touch inside an Imprisonment decides it); 7b54's partial ends (16.48,
19.59, 47.48 s: other debuffs listed on); 6339's Laevatain hits 14.6–19.2 s (the replay ×1.28) and Si's combo final
slots at 11.31 s.
