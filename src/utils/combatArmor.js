const hasValue = (value) => value !== undefined && value !== null && value !== "";

const toNumber = (value) => {
  if (!hasValue(value) || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const firstNumber = (...values) => {
  for (const value of values) {
    const number = toNumber(value);
    if (number !== null) return number;
  }
  return null;
};

const getArmorClassValue = (combatant = {}) => firstNumber(
  combatant.armorClass,
  combatant.ac,
  combatant.baseArmorClass,
  combatant.guardRating,
  combatant.publicDerivedStats?.baseArmorClass,
  combatant.autoRollCharacter?.armorClass,
  combatant.autoRollCharacter?.ac,
  combatant.autoRollCharacter?.guardRating,
  combatant.autoRollCharacter?.publicDerivedStats?.baseArmorClass
);

const getFallbackReduction = (armorClass) => {
  if (armorClass === null) return 0;
  if (armorClass >= 19) return 3;
  if (armorClass >= 16) return 2;
  if (armorClass >= 13) return 1;
  return 0;
};

export function getArmorProfile(combatant = {}) {
  const explicitReduction = toNumber(combatant?.armorReduction);
  if (explicitReduction !== null) {
    return {
      reduction: Math.max(0, explicitReduction),
      source: "explicit",
    };
  }

  const publicArmorReduction = toNumber(combatant?.publicArmor?.reduction);
  if (publicArmorReduction !== null) {
    return {
      reduction: Math.max(0, publicArmorReduction),
      source: "publicArmor",
    };
  }

  const armorReduction = toNumber(combatant?.armor?.reduction);
  if (armorReduction !== null) {
    return {
      reduction: Math.max(0, armorReduction),
      source: "armor",
    };
  }

  const armorClass = getArmorClassValue(combatant);
  return {
    reduction: getFallbackReduction(armorClass),
    source: armorClass === null ? "none" : "AC fallback",
  };
}

export function getArmorReduction(combatant = {}, attack = {}) {
  return getArmorProfile(combatant, attack).reduction;
}

export function applyArmorMitigation({ target, attack, rawDamage } = {}) {
  const profile = getArmorProfile(target || {});
  const raw = Math.max(0, toNumber(rawDamage) ?? 0);
  const armorReduction = Math.max(0, profile.reduction);
  const finalDamage = Math.max(0, raw - armorReduction);

  return {
    ok: true,
    rawDamage: raw,
    armorReduction,
    finalDamage,
    absorbed: raw - finalDamage,
    armorSource: profile.source,
    armorProfile: profile,
    attackName: attack?.name,
    message: finalDamage === 0 ? "Armor absorbed the blow." : "",
  };
}

export default {
  applyArmorMitigation,
  getArmorProfile,
  getArmorReduction,
};
