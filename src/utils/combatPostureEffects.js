import { getCombatPosture } from "./combatPosture.js";

const POSTURE_EFFECTS = {
  defending: {
    label: "Defending",
    defenseModifier: 2,
    damageReduction: 0,
    message: "Target is Defending: +2 defense.",
  },
  evading: {
    label: "Evading",
    defenseModifier: 2,
    damageReduction: 0,
    message: "Target is Evading: +2 defense.",
  },
  blocking: {
    label: "Blocking",
    defenseModifier: 0,
    damageReduction: 2,
    message: "Target is Blocking: -2 final damage.",
  },
};

const toNumber = (value) => {
  if (value === undefined || value === null || value === "" || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const emptyPostureEffect = () => ({
  postureType: "",
  postureLabel: "",
  defenseModifier: 0,
  damageReduction: 0,
  message: "",
});

export function getPostureEffect(target = {}) {
  const posture = getCombatPosture(target || {});
  const effect = POSTURE_EFFECTS[posture?.type];
  if (!effect) return emptyPostureEffect();

  return {
    postureType: posture.type,
    postureLabel: effect.label,
    defenseModifier: effect.defenseModifier,
    damageReduction: effect.damageReduction,
    message: effect.message,
  };
}

export function getPostureDefenseModifier(target = {}) {
  return getPostureEffect(target).defenseModifier;
}

export function getPostureDamageReduction(target = {}) {
  return getPostureEffect(target).damageReduction;
}

export function applyPostureEffectsToAttackPreview({ target, attackPreview } = {}) {
  const postureEffect = getPostureEffect(target);
  const baseTargetArmor = toNumber(attackPreview?.targetArmor);
  const finalTargetArmor = baseTargetArmor === null
    ? null
    : baseTargetArmor + postureEffect.defenseModifier;

  return {
    ...(attackPreview || {}),
    postureEffect,
    baseTargetArmor,
    targetArmor: finalTargetArmor,
    finalTargetArmor,
  };
}

export function applyPostureEffectsToDamage({
  target,
  rawDamage,
  armorReduction,
  finalDamage,
} = {}) {
  const postureEffect = getPostureEffect(target);
  const raw = Math.max(0, toNumber(rawDamage) ?? 0);
  const armor = Math.max(0, toNumber(armorReduction) ?? 0);
  const afterArmor = Math.max(0, toNumber(finalDamage) ?? Math.max(0, raw - armor));
  const postureDamageReduction = Math.max(0, postureEffect.damageReduction);
  const afterPosture = Math.max(0, afterArmor - postureDamageReduction);

  return {
    ok: true,
    rawDamage: raw,
    armorReduction: armor,
    armorFinalDamage: afterArmor,
    postureDamageReduction,
    finalDamage: afterPosture,
    absorbedByPosture: afterArmor - afterPosture,
    postureEffect,
    message: postureEffect.damageReduction > 0 ? postureEffect.message : "",
  };
}

export default {
  applyPostureEffectsToAttackPreview,
  applyPostureEffectsToDamage,
  getPostureDamageReduction,
  getPostureDefenseModifier,
  getPostureEffect,
};
