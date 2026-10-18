// Game constants not found in the tables the engine loads (design
// principle 6). Each has its source; move it to the data layer when its
// table is loaded.

/**
 * Damage taken by a staggered enemy: ×(1 + 0.3), a separate multiplier
 * (defender-side ProdCalcZone). Source: rmxlinux BuffData
 * buff_common_poise_break_damage_taken_scale (value 0.3); Talos Wiki,
 * 666bj and GameKee agree on ×1.3. Not yet checked against a fixture.
 */
export const STAGGER_DAMAGE_TAKEN = 1.3;
