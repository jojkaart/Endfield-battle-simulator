// Enemy facts no game table gives, read from the logs, each with its evidence.
//
// Control immunity (EnemyData.controlImmune). A freezing control status (Si's Immobilization, Tangtang's OLDEN STARE)
// runs a TimeDilationAction on the enemy only while it has no buff tagged 188749032 (BuffData
// buff_chr_0036_jsspsi_normal_skill_hitstop, buff_chr_0027_tangtang_ultskill_debuff: CheckBuffStackNumAdvanced on
// that tag); no enemy file in the data carries the tag, so which enemies are immune comes from the logs. The owner
// (in-game test 104, 2026-11-16): most bosses do freeze, some rare ones ignore it. So an enemy freezes unless listed
// here. A listed enemy's clock and teammates' debuffs run on through the freeze; the freezing operator's own debuffs
// are still held (timeline/actions.ts runTriggers: Si's Artful Intent ends fit only so).
//
// The test for each: the log check with the enemy frozen against immune (2026-11-16, scratch: rank override). Under
// both readings Si's own debuffs are held, so her Artful Intent ends don't tell them apart; teammates' debuffs on the
// enemy (and its own clock) do.
//
// An alias (a stage variant, `eny_0134_jsspsi_…`) takes its template's entry (gameData.ts copies the template).

/** Template enemy id → the logs' evidence that it's control-immune. */
export const CONTROL_IMMUNE_ENEMIES: Readonly<Record<string, string>> = {
  // Alleikhreos, Chiliarch (Boss). c3c735dbb022 (Si's freezes): frozen, Ardelia's Arts Susceptibility is held past
  // where the log's hits fit without it (48.3–54.5 s: Ardelia 139 → 122 plain, Si 120 → 110; they turn assumed or
  // log-listing fallback, no new mismatches). 04d401ad257e has no freezer.
  eny_0125_fdcentur: "c3c735dbb022: frozen holds Ardelia's Arts Susceptibility past the log's (Ardelia 139 → 122 plain, Si 120 → 110)",
  // Si (the enemy; Boss). 4a64e58e75ad: frozen, Si's freezes at ~51–53 s hold Arcane's WILL weapon debuff
  // (buff_wpn_funnel_0016_will_atk, logged to 54731 ms, the frozen replay keeps it to 56.9 s): Arcane 64 → 32 plain,
  // Si 37 → 25, fight damage −36.1 → −33.6% (closer, but by hits ~10% over the log's). 3f78ceb15bc3 leans the other
  // way (Si 20 → 23 plain frozen); 0c14fb3ce77d and e9896c8d02be don't tell. Kept immune on 4a64's 32 hits.
  eny_0134_jsspsi: "4a64e58e75ad: frozen holds Arcane's will_atk past the log's 54.7 s (Arcane 64 → 32 plain, Si 37 → 25); 3f78ceb15bc3 leans frozen (Si 20 → 23)",
};
