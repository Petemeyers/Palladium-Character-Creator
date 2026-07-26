const toNumber = (value) => {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const parseFeet = (value) => {
  const number = toNumber(value);
  if (number !== null) return number;
  if (typeof value !== "string") return null;
  const match = value.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};

const normalize = (value) => String(value ?? "").trim().toLowerCase();
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const getAttribute = (actor, originalName, fallbacks = []) => {
  const sources = [
    actor?.originalActorMetadata?.attributes,
    actor?.attributes,
    actor?.publicAbilityScores,
    actor?.abilityScores,
    actor?.compatibilityAttributes,
    actor?.autoRollCharacter?.publicAbilityScores,
    actor?.autoRollCharacter?.abilityScores,
    actor,
  ];
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    for (const key of [originalName, ...fallbacks]) {
      const number = toNumber(source[key]);
      if (number !== null) return number;
    }
  }
  return 10;
};

export function isExplicitRangedAttack(attack = {}) {
  if (!attack || typeof attack !== "object") return false;
  if (
    attack.isRanged === true ||
    attack.isThrown === true ||
    attack.projectile === true ||
    attack.isProjectile === true
  ) return true;

  const explicitValues = [
    attack.rangeType,
    attack.rangeCategory,
    attack.attackMode,
    attack.weaponType,
    attack.type,
    attack.kind,
    attack.category,
  ].map(normalize);
  if (explicitValues.some((value) => ["ranged", "thrown", "projectile", "missile"].includes(value))) {
    return true;
  }

  const attackType = normalize(attack.attackType);
  if (["ranged", "thrown", "projectile", "missile"].includes(attackType)) return true;
  if (attackType.includes("melee")) return false;

  const name = normalize(attack.name || attack.label || attack.attackName);
  return /\b(longbow|shortbow|bow|crossbow|sling|breath|gun|rifle|pistol|dart|javelin shot|throw|thrown|projectile|missile)\b/.test(name);
}

export function getRangedWeaponRange(attack = {}) {
  if (!isExplicitRangedAttack(attack)) return null;
  return parseFeet(
    attack.rangeProfile?.normal ??
    attack.rangeFt ??
    attack.rangeFeet ??
    attack.normalRangeFt ??
    attack.normalRange ??
    attack.range ??
    attack.metadata?.rangeFt ??
    attack.metadata?.range
  );
}

export function getRangedControlModifier(actor = {}) {
  const deftness = getAttribute(actor, "deftness", ["dexterity", "dex", "PP", "pp"]);
  const awareness = getAttribute(actor, "awareness", ["wisdom", "wis", "ME", "me"]);
  const deftnessModifier = Math.floor((deftness - 10) / 2);
  const awarenessModifier = Math.floor((awareness - 10) / 2);
  return clamp(Math.floor((deftnessModifier + awarenessModifier) / 2), -2, 2);
}

export function getRangedAttackRangeModifier({
  actor = {},
  attack = {},
  distanceFt,
  adjacentHostile = false,
  threatened = adjacentHostile,
  aimBonus = 0,
  visibilityModifier = 0,
  shooterMovementModifier = 0,
  targetMovementModifier = 0,
  fatigueModifier = 0,
} = {}) {
  const isRanged = isExplicitRangedAttack(attack);
  const distance = parseFeet(distanceFt);
  const maxRangeFt = getRangedWeaponRange(attack);
  const controlModifier = getRangedControlModifier(actor);

  if (!isRanged || distance === null || maxRangeFt === null || maxRangeFt <= 0) {
    return {
      isRanged,
      canAttack: isRanged ? null : false,
      distanceFt: distance,
      maxRangeFt,
      band: isRanged ? "unknown" : "not-ranged",
      bandLabel: isRanged ? "Range Unknown" : "Melee",
      baseModifier: 0,
      controlModifier,
      trainingModifier: 0,
      aimModifier: 0,
      visibilityModifier: 0,
      threatenedModifier: 0,
      shooterMovementModifier: 0,
      targetMovementModifier: 0,
      fatigueModifier: 0,
      finalModifier: 0,
      totalModifier: 0,
    };
  }

  const ratio = distance / maxRangeFt;
  if (ratio > 1) {
    return {
      isRanged: true,
      canAttack: false,
      distanceFt: distance,
      maxRangeFt,
      band: "out-of-range",
      bandLabel: "Out of Range",
      baseModifier: null,
      controlModifier,
      trainingModifier: 0,
      aimModifier: 0,
      visibilityModifier: 0,
      threatenedModifier: 0,
      shooterMovementModifier: 0,
      targetMovementModifier: 0,
      fatigueModifier: 0,
      finalModifier: null,
      totalModifier: null,
    };
  }

  let band = "extreme";
  let bandLabel = "Extreme Range";
  let baseModifier = -4;
  if (ratio <= 0.2) {
    band = "close";
    bandLabel = "Close Range";
    baseModifier = threatened ? -2 : 1;
  } else if (ratio <= 0.6) {
    band = "standard";
    bandLabel = "Standard Range";
    baseModifier = 0;
  } else if (ratio <= 0.85) {
    band = "long";
    bandLabel = "Long Range";
    baseModifier = -2;
  }

  const training = actor?.rangedTrainingProfile;
  const familyMatches = normalize(training?.weaponFamily) === normalize(attack?.weaponFamily);
  const trainingModifier = familyMatches ? toNumber(training?.specializationBonus) ?? 0 : 0;
  const proficiencyModifier = familyMatches ? toNumber(training?.proficiencyBonus) ?? 0 : 0;
  const proficiencyAlreadyIncluded = familyMatches && training?.existingAttackBonusIncludesProficiency === true;
  const aimModifier = clamp(toNumber(aimBonus) ?? 0, 0, 2);
  const visibility = toNumber(visibilityModifier) ?? 0;
  const shooterMovement = toNumber(shooterMovementModifier) ?? 0;
  const targetMovement = toNumber(targetMovementModifier) ?? 0;
  const fatigue = Math.min(0, toNumber(fatigueModifier) ?? 0);
  const finalModifier = baseModifier;
  const totalModifier = finalModifier + trainingModifier + aimModifier + visibility
    + shooterMovement + targetMovement + fatigue;

  return {
    isRanged: true,
    canAttack: true,
    distanceFt: distance,
    maxRangeFt,
    band,
    bandLabel,
    baseModifier,
    controlModifier,
    proficiencyModifier,
    proficiencyAlreadyIncluded,
    trainingModifier,
    aimModifier,
    visibilityModifier: visibility,
    threatenedModifier: threatened && band === "close" ? -2 : 0,
    threatened: Boolean(threatened),
    shooterMovementModifier: shooterMovement,
    targetMovementModifier: targetMovement,
    fatigueModifier: fatigue,
    finalModifier,
    totalModifier,
    components: Object.freeze({
      proficiency: proficiencyModifier,
      proficiencyApplied: proficiencyAlreadyIncluded ? 0 : proficiencyModifier,
      specialization: trainingModifier,
      range: threatened && band === "close" ? 0 : finalModifier,
      aim: aimModifier,
      visibility,
      threatenedClose: threatened && band === "close" ? -2 : 0,
      shooterMovement,
      targetMovement,
      fatigue,
    }),
  };
}

export function applyRangedAttackRangeModifierToBonus({
  actor = {},
  attack = {},
  distanceFt,
  baseAttackBonus = 0,
  adjacentHostile = false,
  threatened = adjacentHostile,
  aimBonus = 0,
  visibilityModifier = 0,
  shooterMovementModifier = 0,
  targetMovementModifier = 0,
  fatigueModifier = 0,
} = {}) {
  const profile = getRangedAttackRangeModifier({
    actor,
    attack,
    distanceFt,
    adjacentHostile,
    threatened,
    aimBonus,
    visibilityModifier,
    shooterMovementModifier,
    targetMovementModifier,
    fatigueModifier,
  });
  const safeBaseAttackBonus = toNumber(baseAttackBonus) ?? 0;
  const blocked = profile.isRanged && profile.canAttack === false;
  const rangeModifier = profile.isRanged && profile.canAttack === true
    ? profile.finalModifier ?? 0
    : 0;
  const contextualModifier = profile.isRanged && profile.canAttack === true
    ? profile.totalModifier ?? rangeModifier
    : 0;
  return {
    ...profile,
    blocked,
    rangeModifier,
    contextualModifier,
    baseAttackBonus: safeBaseAttackBonus,
    modifiedAttackBonus: safeBaseAttackBonus + contextualModifier,
  };
}

export const formatRangeModifier = (value) => {
  const number = toNumber(value);
  if (number === null) return "n/a";
  return number >= 0 ? `+${number}` : String(number);
};

export default getRangedAttackRangeModifier;
