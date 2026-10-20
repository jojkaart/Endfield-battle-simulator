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

/**
 * The atbSourceType of a finisher's SP. Its grant (GainBreakingAttackAtb)
 * names no source type; the finishers whose SkillData has an SP grant of
 * their own (ObtainCostAction costType 1, a literal 0: chr_0002_endminm,
 * chr_0003_endminf, chr_0012_avywen, chr_0016_laevat, chr_0024_deepfin
 * _power_attack) all give it atbSourceType 0, so the finisher's SP is taken
 * to be of that type (batch-3 T3). Not table-backed per skill; not checked
 * in game.
 */
export const FINISHER_SP_SOURCE_TYPE = 0;
