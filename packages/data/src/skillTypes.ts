// Every node type ($type) the fetched SkillData and BuffData files hold,
// by what the data layer does with it: interpreted (the compiler, the timing
// reader, the buff reader), a condition the compiler leaves as an undecided
// branch, or walked without being interpreted, with why. A game patch that
// adds a type fails packages/data/test/skillTypes.test.ts until it's listed
// here (design principle 7: an explicit supported subset), so a new
// mechanic can't pass unnoticed through skillCompile.ts's generic walk.

/** A node's type name as listed here: its $type's last dotted part without the `+…Data` suffix (`IfElseAction`, `Selector+AllEnemyFinder`, `CheckHp`). */
export function nodeTypeName($type: string): string {
  const name = $type.split(",")[0] ?? $type;
  return (name.split(".").pop() ?? name).replace(/\+[A-Za-z]*Data$/, "");
}

/** Interpreted: what each reader makes of it is in its own code. */
export const INTERPRETED_TYPES: Readonly<Record<string, readonly string[]>> = {
  // skillCompile.ts exec: damage, effects, costs, buffs, entities, control flow.
  "skillCompile.ts actions": [
    "DamageAction", "SpellInfliction", "ForceSpellStatusAction", "AirborneAction", "KnockDownAction", "CrushAction", "FractureAction", "FinishBuffAdvanced", "FinishBuffAction",
    "ObtainCostAction", "HealAction", "ObtainUspInNormalSkill", "CreateBuffAction", "AuraAction", "CreateGlobalBuffAction", "LaunchProjectile", "SpawnAbilityEntity", "CastSkill",
    "FindTargetAction", "ContinuousFindTargetAction", "IfElseAction", "SwitchAction", "ForEachAction", "DoOnceAction", "ChannelingAction", "ChannelingActionV2", "TickIntervalAction",
    "ExecuteIntervalAction", "JumpToAction", "SimpleCalcBBAction", "ModifyDynamicBlackboard", "RefrainObtainUsp", "EventListenerAction", "VulnerableAction", "TargetPostProcessorAction",
    "NotNextCheckAction", "DebugPrintAction",
  ],
  // skillCompile.ts evalPlain: decided for one enemy, or said as a kit predicate.
  "skillCompile.ts conditions": [
    "CompareFloat", "CheckEntityNum", "CheckObjectTypeMatch", "CheckSquadInFight", "CheckTargetsEqual", "OrConditionAction", "CheckMainCharacterCondition", "Probablity",
    "CheckBuffStackNumAdvanced", "CheckBuffStackNum", "CheckBuffIdInContextAdvanced", "CheckTagMatch", "CheckDamageTag",
  ],
  // skillCompile.ts damage units and targets: scale, stagger, bonuses, the team and the controlled operator.
  "skillCompile.ts parts": ["AtkScaleCalculation", "BreakingAttackCalculation", "DefiniteValueCalculation", "DamageScaleProcessor", "InstantModifyAttribute", "Selector+CharacterTeamFinder", "Selector+MainCharacterValidator"],
  // skillData.ts timing (windows, locks, channels, time stops) and buffData.ts (basic-attack input, skill switches, cast-attached effects).
  "skillData.ts and buffData.ts": [
    "AllowNextSkillAction", "ChannelingCastingAction", "InterruptCurSkillAction", "MarkCanInterrupt", "TogglableAction", "UltimateTimeAction", "TimeDilationAction", "ComboCacheAction",
    "ChangeSkillAction", "CreateBuffAttachingSkill", "CheckDamageDecorateMask", "CheckSkillCastId",
  ],
};

/** Conditions the compiler can't decide or say: each is an undecided branch, labelled with the condition (CompiledLanding.branch); kits say which side happens. */
export const UNDECIDED_CONDITIONS: readonly string[] = [
  "CheckAbilityEntityCurDuration", "CheckAbilityEntityFinishReason", "CheckAllowNormalSkillHighlight", "CheckBuffFromSource", "CheckBuffIdInContext", "CheckBuffStackNumByTag",
  "CheckComboSkillCameraAlphaSetting", "CheckConsumeBuffLayer", "CheckCurHpRatio", "CheckCustomAbilityEvent", "CheckDamageIgnoreImmuneLevel", "CheckDamageTransferredSource", "CheckDamageType",
  "CheckDamageTypeMask", "CheckDistanceCondition", "CheckDungeonCategory", "CheckEnemyRank", "CheckGlobalCDTimerAction", "CheckHasMoveInput", "CheckHealTag", "CheckHp", "CheckMoveSpeed",
  "CheckNavmeshRaycastCondition", "CheckObtainAtbType", "CheckOriginSkillType", "CheckOverHeal", "CheckPartTagMatch", "CheckPerfectDodgeDirection", "CheckPhysicalInflictionType",
  "CheckPoiseValue", "CheckProfession", "CheckProjectileIgnoreImmuneLevel", "CheckProjectileInPerfectDodgeCd", "CheckSkillCameraMotionFree", "CheckSkillHasHit", "CheckSkillId",
  "CheckSkillInterruptReason", "CheckSkillType", "CheckSpellInflictionType", "CheckSuperArmor", "CheckTargetAngle", "CheckTargetContains", "CheckTargetInScreen", "CheckTimedMarkerCondition",
  "CheckTwoDirectionAngle", "CheckUsp", "CompareDeckAttr", "CompareString",
];

/** Walked without being interpreted (skillCompile.ts generic: their nested sequences are followed), by why. */
export const UNINTERPRETED_TYPES: Readonly<Record<string, readonly string[]>> = {
  "Presentation (animation, camera, effects, sound, voice, UI, floating text): changes no number.": [
    "AddCameraControlStateAction", "AddDynamicCcsAction", "AnimEventReceiver", "AnimatedCameraAction", "AnimatorAimOffsetAction", "BoneAttachAction", "CameraImpulseAction", "CameraRotateAction",
    "CharHurtAnimAction", "CharWeaponAnimationAction", "CharWeaponVisibleAction", "ContinuousSetAnimTimeScale", "EffectAction", "EnemyHurtAnimAction", "FlowTextAction", "FootStepChangeAction",
    "ForceHideHeadBarAction", "HideUIAction", "HurtAnimAction", "IgniteBuffTextAction", "ImmuneTextAction", "InheritCCSAction", "LockCameraAimAction", "ModifyWeaponMountPoint",
    "NotifyCharPassiveUIAction", "OverrideCameraFollowAction", "PlayAnimationAction", "PlayAnimationWithStep", "PlayPerfectDodgeAnim", "PlaySoundAction", "RayCastEffectAction",
    "RefreshHeadBarShowHideAction", "SetAnimTimeScaleAction", "SetAnimatorParamAction", "SetSkinEffectKeyAction", "ShakeCountShieldUIAction", "ShowComboRingQte", "ShowComboSkillUI",
    "ShowHideActorAction", "ShowTyphoeaHudHint", "TriggerLiinoUIEvent", "UltimateShowAction", "VoiceInterruptAction", "VoiceTriggerAction", "SetIgnoreGlobalTimeScaleAction",
  ],
  "Movement and position (motion, colliders, teleports, knock-backs, turning, physics casts): one enemy at a fixed distance.": [
    "BlockMoveInterruptSkill", "BlowOffAction", "BlowOffCharacterAction", "BlowOffEnemyAction", "BreakInteractiveAction", "BreakPassingSmallSceneObject", "ChangeMoveGaitMultiplier",
    "ChangePushBackDistanceFactor", "ChangeSpecificLayerAction", "CustomRootMotionAction", "DisableMoveColliderAction", "DisableRootMotionAction", "EnableMoveColliderAction", "LaunchUpwardAction",
    "MoveGaitAction", "MoveToAction", "MoveToTargetAction", "PhysicsCastAction", "PullAction", "PushBackAction", "ReceiveMoveInputAction", "SelfRotateAction", "SetStrafeModeAction",
    "SnapToTargetWithRangeAction", "TeleportAction", "TeleportPosSelectAction", "TryToTeleportSquadAction", "SkillAIMoveAction", "TyphoeaArcheryGetPhantomPosAction",
  ],
  "Targeting (finders, validators, sorters): one enemy, every hit lands on it.": [
    "Selector+AbilityEntityTargetFinder", "Selector+AllEnemyFinder", "Selector+CheckRaycastValidator", "Selector+CircularOrderSort", "Selector+ConvertToSlot", "Selector+CurHpRatioValidator",
    "Selector+DistanceValidator", "Selector+ExcludeOwnerValidator", "Selector+ExcludeTarget", "Selector+FixedPointFinder", "Selector+GodEntityFinder", "Selector+HitBoxFinder",
    "Selector+HittableObjectValidator", "Selector+InFightEnemyFinder", "Selector+InScreenValidator", "Selector+InteractiveShapeFinder", "Selector+MainTargetFinder",
    "Selector+NavMeshRaycastPointFinder", "Selector+OwnerMountPointPosFinder", "Selector+OwnerPartsFinder", "Selector+OwnerSoulFinder", "Selector+OwnerSpawnedEntityFinder", "Selector+PointFinder",
    "Selector+PriorityFilter", "Selector+ProjectileFinder", "Selector+RandomPointFinder", "Selector+ReplacePartWithMainBody", "Selector+ShapeFinder", "Selector+ShuffleTarget",
    "Selector+SkillCastIdValidator", "Selector+SmartTargetFinder", "Selector+SnapPointFinder", "Selector+SourceFinder", "Selector+TagValidator", "Selector+TargetContainsValidator",
    "Selector+TyphoeaArcherySelectedFinder", "TyphoeaArcheryTargetSelect", "TyphoeaIsInShootingRangeAction", "PickTargetAction", "MergeTargetAction", "ConvertToTargetContext", "UpdateGlobalContextTarget", "ForceTargetInFightAction",
  ],
  "Input and controls (dashes, buttons, combo prompts, mode switches): the rotation decides; skill timing comes from skillData.ts.": [
    "AttackClickListenerAction", "ChangeGeneralAbilityButton", "ChangeSkillType", "LockMainCharacterToggleAction", "MarkCanDash", "MarkInheritSkillCastIdOnNormalAttack", "OverrideMultiDashLimit",
    "SetFirstDashParam", "TemporaryUnlockAction", "TriggerComboSkillAction", "PauseComboSkillTime", "SwitchModeAction", "RecoverDashEnergy", "TyphoeaArcheryBrainToggleRegisterAction",
    "TyphoeaArcheryChipDataAction",
  ],
  "Values saved for later reads: the blackboard keys they write become unknown values (skillCompile.ts invalidate), shown as `$key?` or `Type→key`.": [
    "CurveEvaluateFloat", "GetCharBySquadSlot", "GetTargetBuffBBAction", "GetTargetBuffBBAdvanced", "ModifyCollectedBuffBbValue", "RandomAction", "ReadSkillSettingData", "SaveAtbObtainValue",
    "SaveBuffLifeTime", "SaveBuffStackNum", "SaveBuffStackNumAdvanced", "SaveBuffStackNumByTag", "SaveCameraAngle", "SaveCharTypeId", "SaveCharTypeIdToIntBySquadSlot", "SaveCollectedBuffBbValue",
    "SaveDamageContext", "SaveMoveAxisAngle", "SaveTargetDistanceAction", "SaveTransferredSource", "SaveTwoDirectionAngle", "StoreAttributeValue", "StoreBuffCount", "StoreCurSkillExecuteFrame",
    "StoreEntityProperty", "StoreSkillDamageType",
  ],
  "Damage, heal and stagger parts the compiler doesn't read: kits write crit and penetration bonuses, other bases (`base`) and heals by hand.": [
    "AttackCriticalRateProcessor", "AttackerPenProcessor", "InstantModifyAttributeForHeal", "InstantModifyAttributeForPoise", "ModifyCalcResult", "ModifyHealCalcResult",
    "MultiplyAttributeCalculation", "PrimaryAttrCalculation",
  ],
  "Mechanics the compiler doesn't model: kits hand-write them (buffs, triggers, Link, cooldowns), the engine has its own rule, or they're outside a one-enemy fight.": [
    "AddAIMarkerAction", "AddGlobalCDTimer", "AddTagAction", "AddTagToEntities", "BombClearAction", "BombTouchLayerAction", "ClearProjectileAction", "ComboAction", "CreateAdditionalBattleShape",
    "CreateDynamicBattleShape", "CreateTimedMarker", "DispelAction", "EnhancedAction", "ExtendBuffAction", "FinishBuffByTag", "FinishCurBuff", "FinishGlobalBuffAction", "FinishOwnerAction",
    "ForceTriggerWeakness", "GainBreakingAttackAtb", "GainCostAction", "HitStopAction", "IgniteAction", "IgnoreModelIntervalCheck", "InheritBuffAction", "InterruptAction", "InverseSpellInfliction",
    "ModifyResilienceDecreaseFactor", "OnPhysicalNoGuardStart", "OnSpellAbnormalStartFinish", "OnSpellInflictionStart", "OverrideRawAttributeAction", "PauseBuffTime", "RaiseTrainLevelEvent",
    "RecordBattleDetails", "RecoverPoiseAction", "RefreshBuffAttrModifierValue", "SealAction", "SendBattleSignalToLevel", "SetAbilityEntityDuration", "SetAbilityEntityTarget",
    "SetBuffDurationAction", "SetDamageTagImmuneRule", "SetSkillCdAtOnce", "SetSuperArmorAction", "ShelterAction", "SkillAffixAction", "SlowAction", "SpeedupAction", "TakeDownAction",
    "TagQueryListenerAction", "TriggerCharSpellInflictionEvent", "TriggerCustomAbilityEvent", "TriggerSpellBurstEventAction", "WeakAction",
  ],
};

/** Every listed type, with where it's listed (a type is listed once). */
export function listedNodeTypes(): Map<string, string> {
  const out = new Map<string, string>();
  const add = (group: string, types: readonly string[]) => {
    for (const t of types) {
      if (out.has(t)) throw new Error(`skillTypes.ts: ${t} is listed under both "${out.get(t)}" and "${group}"`);
      out.set(t, group);
    }
  };
  for (const [g, ts] of Object.entries(INTERPRETED_TYPES)) add(g, ts);
  add("undecided conditions", UNDECIDED_CONDITIONS);
  for (const [g, ts] of Object.entries(UNINTERPRETED_TYPES)) add(g, ts);
  return out;
}
