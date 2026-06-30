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
      finalModifier: 0,
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
      finalModifier: null,
    };
  }

  let band = "long";
  let bandLabel = "Long Range";
  let baseModifier = -2;
  if (ratio <= 0.25) {
    band = "close";
    bandLabel = "Close Range";
    baseModifier = adjacentHostile ? 0 : 1;
  } else if (ratio <= 0.6) {
    band = "effective";
    bandLabel = "Effective Range";
    baseModifier = 0;
  }

  const finalModifier = band === "long"
    ? clamp(baseModifier + controlModifier, -4, 0)
    : baseModifier;

  return {
    isRanged: true,
    canAttack: true,
    distanceFt: distance,
    maxRangeFt,
    band,
    bandLabel,
    baseModifier,
    controlModifier,
    finalModifier,
  };
}

export const formatRangeModifier = (value) => {
  const number = toNumber(value);
  if (number === null) return "n/a";
  return number >= 0 ? `+${number}` : String(number);
};

export default getRangedAttackRangeModifier;
