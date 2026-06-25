import { applyPostureEffectsToAttackPreview } from "./combatPostureEffects.js";

const hasValue = (value) => value !== undefined && value !== null && value !== "";

const toNumber = (value) => {
  if (!hasValue(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const formatBonus = (value) => {
  const number = toNumber(value);
  if (number === null) return "";
  return number >= 0 ? `+${number}` : String(number);
};

const firstValue = (...values) => values.find(hasValue);

const getName = (entity, fallback) =>
  String(firstValue(entity?.name, entity?.autoRollCharacter?.name, fallback));

const getTargetArmor = (target = {}) =>
  toNumber(firstValue(
    target.armorClass,
    target.ac,
    target.baseArmorClass,
    target.guardRating,
    target.publicDerivedStats?.baseArmorClass,
    target.autoRollCharacter?.armorClass,
    target.autoRollCharacter?.ac,
    target.autoRollCharacter?.guardRating,
    target.autoRollCharacter?.publicDerivedStats?.baseArmorClass
  ));

export const parsePublicDamageExpression = (expression) => {
  if (!hasValue(expression)) return null;
  const normalized = String(expression).replace(/\s+/g, "");
  const match = normalized.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) return null;

  const diceCount = toNumber(match[1]);
  const dieSize = toNumber(match[2]);
  const modifier = toNumber(match[3] || 0);

  if (!diceCount || !dieSize || diceCount < 1 || dieSize < 1 || modifier === null) return null;

  return {
    expression: normalized,
    diceCount,
    dieSize,
    modifier,
  };
};

const getAttackBonus = (attack = {}) => {
  const value = firstValue(attack.hitBonus, attack.attackBonus);
  if (typeof value === "string") {
    const parsed = toNumber(value.replace(/^\+/, ""));
    return parsed;
  }
  return toNumber(value);
};

const getDamageExpression = (attack = {}) =>
  firstValue(attack.damageExpression, attack.damage);

const rollDiceTotal = (diceCount, dieSize) => {
  let total = 0;
  for (let index = 0; index < diceCount; index += 1) {
    total += Math.floor(Math.random() * dieSize) + 1;
  }
  return total;
};

const rollDamageTotal = (damage, rollDamage) => {
  if (typeof rollDamage === "function") {
    const injected = rollDamage({
      diceCount: damage.diceCount,
      dieSize: damage.dieSize,
      modifier: damage.modifier,
      expression: damage.expression,
    });
    const injectedNumber = toNumber(injected);
    if (injectedNumber !== null) return injectedNumber;
  }
  return rollDiceTotal(damage.diceCount, damage.dieSize);
};

export function resolvePublicBasicAttack({
  attacker,
  target,
  attack,
  rollD20,
  rollDamage,
} = {}) {
  const missingFields = [];
  const warnings = [];
  const attackerName = getName(attacker, "Attacker");
  const targetName = getName(target, "Target");
  const attackName = String(firstValue(attack?.name, "Basic Attack"));
  const attackBonus = getAttackBonus(attack);
  const targetArmor = getTargetArmor(target);
  const posturePreview = applyPostureEffectsToAttackPreview({
    target,
    attackPreview: { targetArmor },
  });
  const finalTargetArmor = posturePreview.finalTargetArmor;
  const postureEffect = posturePreview.postureEffect;
  const damageExpression = getDamageExpression(attack);
  const damage = parsePublicDamageExpression(damageExpression);

  if (!attacker) missingFields.push("attacker");
  if (!target) missingFields.push("target");
  if (!attack) missingFields.push("attack");
  if (attackBonus === null) missingFields.push("attackBonus");
  if (targetArmor === null) missingFields.push("targetArmor");
  if (!damage) missingFields.push("damageExpression");

  if (missingFields.length > 0) {
    return {
      ok: false,
      attackerName,
      targetName,
      attackName,
      d20Roll: null,
      attackBonus,
      totalToHit: null,
      targetArmor: finalTargetArmor,
      baseTargetArmor: targetArmor,
      finalTargetArmor,
      postureEffect,
      hit: false,
      damageRoll: null,
      damageTotal: null,
      damageType: attack?.damageType,
      message: `${attackerName} cannot resolve ${attackName}: missing ${missingFields.join(", ")}.`,
      missingFields,
      warnings,
    };
  }

  const d20Roll = typeof rollD20 === "function"
    ? toNumber(rollD20({ attacker, target, attack }))
    : rollDiceTotal(1, 20);

  if (d20Roll === null) {
    missingFields.push("d20Roll");
    return {
      ok: false,
      attackerName,
      targetName,
      attackName,
      d20Roll: null,
      attackBonus,
      totalToHit: null,
      targetArmor: finalTargetArmor,
      baseTargetArmor: targetArmor,
      finalTargetArmor,
      postureEffect,
      hit: false,
      damageRoll: null,
      damageTotal: null,
      damageType: attack?.damageType,
      message: `${attackerName} cannot resolve ${attackName}: missing d20Roll.`,
      missingFields,
      warnings,
    };
  }

  const totalToHit = d20Roll + attackBonus;
  const hit = totalToHit >= finalTargetArmor;

  if (!hit) {
    return {
      ok: true,
      attackerName,
      targetName,
      attackName,
      d20Roll,
      attackBonus,
      totalToHit,
      targetArmor: finalTargetArmor,
      baseTargetArmor: targetArmor,
      finalTargetArmor,
      postureEffect,
      hit: false,
      damageRoll: null,
      damageTotal: null,
      damageType: attack?.damageType,
      message: `${attackerName} misses ${targetName} with ${attackName}: d20 ${d20Roll} ${formatBonus(attackBonus)} = ${totalToHit} vs AC/Guard ${finalTargetArmor}.${postureEffect.message ? ` ${postureEffect.message}` : ""}`,
      missingFields,
      warnings,
    };
  }

  const damageRoll = rollDamageTotal(damage, rollDamage);
  const damageTotal = damageRoll + damage.modifier;
  const damageType = attack?.damageType;

  return {
    ok: true,
    attackerName,
    targetName,
    attackName,
    d20Roll,
    attackBonus,
    totalToHit,
    targetArmor: finalTargetArmor,
    baseTargetArmor: targetArmor,
    finalTargetArmor,
    postureEffect,
    hit: true,
    damageRoll,
    damageTotal,
    damageType,
    message: `${attackerName} hits ${targetName} with ${attackName}: d20 ${d20Roll} ${formatBonus(attackBonus)} = ${totalToHit} vs AC/Guard ${finalTargetArmor}.${postureEffect.message ? ` ${postureEffect.message}` : ""} Damage: ${damageTotal}${damageType ? ` ${damageType}` : ""}.`,
    missingFields,
    warnings,
  };
}

export default {
  parsePublicDamageExpression,
  resolvePublicBasicAttack,
};
