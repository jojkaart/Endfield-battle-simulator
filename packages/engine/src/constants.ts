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

/**
 * A dive's movement, from the native MovementSetting_Default and each
 * character's plungingAttackData, which aren't in the data: the values as
 * Endaxis's game-data compiler extracted them (movementSettingCatalog and
 * the operators' plungingAttack startDuration; read, not copied,
 * 2026-10-21). A jump starts at the speed that reaches `maxJumpHeight` (m)
 * under `gravity` (m/s²); the plunge starts once the operator is
 * `minHeight` up (an attack input before then waits for it), hovers
 * `startSeconds` (the start segment, at no speed), then falls at
 * `downSpeed` (m/s), and the landing skill starts on the frame it reaches
 * the ground. Every operator has the same values there (Zhuang Fangyi
 * overrides downSpeed with 200, which changes no frame). Assumed: the
 * player jumps from the ground and attacks at once; not checked in game.
 */
export const DIVE_MOTION = { maxJumpHeight: 2.1, gravity: 40, minHeight: 0.6, startSeconds: 0.633, downSpeed: 60 } as const;
