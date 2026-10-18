// The game's numeric attribute types. Names follow End-DPScope's
// research/附录A 全属性列表.md (MIT); entries marked "verified" were checked
// against our own data and in-game values (docs/game-data-format.md).

export const Attr = {
  Level: 0,
  MaxHp: 1, // verified: Laevatain Lv90 5495
  Atk: 2, // verified: Laevatain Lv90 318, in-game panel
  Def: 3, // verified: gear DEF sums to in-game 140
  PhysicalDamageTakenScalar: 4,
  FireDamageTakenScalar: 5,
  PulseDamageTakenScalar: 6,
  CrystDamageTakenScalar: 7,
  Weight: 8,
  CriticalRate: 9, // base 0.05 in CharacterTable
  CriticalDamageIncrease: 10,
  Hatred: 11,
  NormalAttackRange: 12,
  MoveSpeedScalar: 13,
  TurnRateScalar: 14,
  AttackRate: 15,
  SkillCooldownScalar: 16,
  NormalAttackDamageIncrease: 17, // verified: Laevatain P2 +15% basic attack DMG (Zero Sanity hit table)
  HpRecoveryPerSec: 18,
  HpRecoveryPerSecByMaxHpRatio: 19,
  MaxPoise: 20, // verified: Rhodagn 280 = Talos Wiki stagger HP
  PoiseRecTime: 21,
  MaxUltimateSp: 22,
  DamageTakenScalarWithPoise: 23,
  PoiseDamageTakenScalar: 24,
  PhysicalInflictionDamageScalar: 25,
  PoiseDamageOutputScalar: 26,
  BreakingAttackDamageTakenScalar: 27,
  UltimateSkillDamageIncrease: 28,
  HealOutputIncrease: 29,
  HealTakenIncrease: 30,
  PoiseRecTimeScalar: 31,
  NormalSkillDamageIncrease: 32,
  ComboSkillDamageIncrease: 33,
  KnockDownTimeAddition: 34,
  FireBurstDamageIncrease: 35,
  PulseBurstDamageIncrease: 36,
  CrystBurstDamageIncrease: 37,
  NaturalBurstDamageIncrease: 38,
  Str: 39, // verified: Laevatain panel
  Agi: 40, // verified: Laevatain panel
  Wisd: 41, // INT; verified: Laevatain panel
  Will: 42, // verified: Laevatain panel
  LifeSteal: 43,
  UltimateSpGainScalar: 44,
  AtbCostAddition: 45,
  SkillCooldownAddition: 46,
  ComboSkillCooldownScalar: 47,
  NaturalDamageTakenScalar: 48,
  IgniteDamageScalar: 49,
  PhysicalDamageIncrease: 50,
  FireDamageIncrease: 51, // verified: Forgeborn Scathe, Hot Work Gauntlets (Zero Sanity hit table)
  PulseDamageIncrease: 52,
  CrystDamageIncrease: 53,
  NaturalDamageIncrease: 54,
  EtherDamageIncrease: 55,
  FireAbnormalDamageIncrease: 56,
  PulseAbnormalDamageIncrease: 57,
  CrystAbnormalDamageIncrease: 58,
  NaturalAbnormalDamageIncrease: 59,
  EtherDamageTakenScalar: 60,
  DamageToBrokenUnitIncrease: 61,
  WeaknessDmgScalar: 62,
  ShelterDmgScalar: 63,
  PhysicalEnhancedDmgIncrease: 64,
  FireEnhancedDmgIncrease: 65,
  PulseEnhancedDmgIncrease: 66,
  CrystEnhancedDmgIncrease: 67,
  NaturalEnhancedDmgIncrease: 68,
  EtherEnhancedDmgIncrease: 69,
  PhysicalVulnerableDmgIncrease: 70,
  FireVulnerableDmgIncrease: 71,
  PulseVulnerableDmgIncrease: 72,
  CrystVulnerableDmgIncrease: 73,
  NaturalVulnerableDmgIncrease: 74,
  EtherVulnerableDmgIncrease: 75,
  AtkIncreaseFactorFromStr: 76,
  AtkIncreaseFactorFromAgi: 77,
  AtkIncreaseFactorFromWisd: 78,
  AtkIncreaseFactorFromWill: 79,
  PhysicalDmgResistScalar: 80,
  NaturalDmgResistScalar: 81,
  CrystDmgResistScalar: 82,
  PulseDmgResistScalar: 83,
  FireDmgResistScalar: 84,
  EtherDmgResistScalar: 85,
  SlowActionSpeedScalar: 86,
  PhysicalAndSpellInflictionEnhance: 87, // Arts Intensity
  ShieldOutputIncrease: 88,
  ShieldTakenIncrease: 89,
  NormalAttackStartRange: 90,
  InAirMoveSpeedScalar: 91,
  KeywordSpeedUpScalar: 92,
  ComboSkillCooldownRecoveryScalar: 93,
} as const;

export type AttrType = number;

const NAMES = new Map<number, string>(Object.entries(Attr).map(([name, id]) => [id, name]));

export function attrName(type: AttrType): string {
  return NAMES.get(type) ?? `Attr${type}`;
}

/** Damage elements as the tables name them (UI: Heat = fire, Electric = pulse, Cryo = cryst). */
export const ELEMENTS = ["physical", "fire", "pulse", "cryst", "natural", "ether"] as const;
export type Element = (typeof ELEMENTS)[number];

export const ELEMENT_DAMAGE_INCREASE: Record<Element, AttrType> = {
  physical: Attr.PhysicalDamageIncrease,
  fire: Attr.FireDamageIncrease,
  pulse: Attr.PulseDamageIncrease,
  cryst: Attr.CrystDamageIncrease,
  natural: Attr.NaturalDamageIncrease,
  ether: Attr.EtherDamageIncrease,
};

export const ELEMENT_AMP: Record<Element, AttrType> = {
  physical: Attr.PhysicalEnhancedDmgIncrease,
  fire: Attr.FireEnhancedDmgIncrease,
  pulse: Attr.PulseEnhancedDmgIncrease,
  cryst: Attr.CrystEnhancedDmgIncrease,
  natural: Attr.NaturalEnhancedDmgIncrease,
  ether: Attr.EtherEnhancedDmgIncrease,
};

export const ELEMENT_SUSCEPTIBILITY: Record<Element, AttrType> = {
  physical: Attr.PhysicalVulnerableDmgIncrease,
  fire: Attr.FireVulnerableDmgIncrease,
  pulse: Attr.PulseVulnerableDmgIncrease,
  cryst: Attr.CrystVulnerableDmgIncrease,
  natural: Attr.NaturalVulnerableDmgIncrease,
  ether: Attr.EtherVulnerableDmgIncrease,
};

export const SKILL_TYPES = ["basic", "battle", "combo", "ultimate"] as const;
export type SkillType = (typeof SKILL_TYPES)[number];

export const SKILL_TYPE_DAMAGE_INCREASE: Record<SkillType, AttrType> = {
  basic: Attr.NormalAttackDamageIncrease,
  battle: Attr.NormalSkillDamageIncrease,
  combo: Attr.ComboSkillDamageIncrease,
  ultimate: Attr.UltimateSkillDamageIncrease,
};
