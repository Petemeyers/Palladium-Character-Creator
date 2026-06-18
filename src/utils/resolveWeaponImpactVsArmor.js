/**
 * Browser-safe ESM copy of the weapon attack vs armor helpers.
 * Keep behavior aligned with resolveWeaponImpactVsArmor.cjs for engine workers.
 */
export function resolveWeaponImpactVsArmor({
  defender,
  attackTotal,
  damage,
  slot = "chest",
  isCrit = false,
  isFumble = false,
}) {
  const dmg = Math.max(0, Number(damage) || 0);
  const total = Number(attackTotal);

  if (isFumble) {
    const s = typeof slot === "string" && slot ? slot : "chest";
    return {
      outcome: "miss",
      damageToHP: 0,
      damageToArmor: 0,
      armorBroken: false,
      armor: null,
      slot: s,
    };
  }

  const equistaminad = defender?.equistaminad || {};
  const useSlot = typeof slot === "string" && slot ? slot : "chest";
  const armor =
    equistaminad?.[useSlot] ||
    equistaminad?.armor ||
    equistaminad?.chest ||
    defender?.equistaminadArmorItem ||
    null;

  const armorGuardRating = Number(armor?.guardRating ?? armor?.guardRating ?? armor?.guardRating ?? armor?.defense ?? 0) || 0;

  let armorarmorDurability = Number(armor?.currentarmorDurability);
  if (!Number.isFinite(armorarmorDurability)) {
    armorarmorDurability = Number(armor?.armorDurability ?? 0) || 0;
  }

  const hasArmor = !!(armor && armorGuardRating > 0 && armorarmorDurability > 0);

  if (!hasArmor) {
    const naturalAR = Number(
      defender?.naturalAR ??
        defender?.baseGuardRating ??
        defender?.nakedAR ??
        defender?.guardRating ??
        defender?.guardRating ??
        10
    );

    if (isCrit || total >= naturalAR) {
      return {
        outcome: "hp",
        damageToHP: dmg,
        damageToArmor: 0,
        armorBroken: false,
        armor: null,
        slot: useSlot,
      };
    }

    return {
      outcome: "miss",
      damageToHP: 0,
      damageToArmor: 0,
      armorBroken: false,
      armor: null,
      slot: useSlot,
    };
  }

  if (isCrit || total >= armorGuardRating) {
    return {
      outcome: "hp",
      damageToHP: dmg,
      damageToArmor: 0,
      armorBroken: false,
      armor,
      slot: useSlot,
    };
  }

  const nextarmorDurability = Math.max(0, armorarmorDurability - dmg);

  return {
    outcome: "armor",
    damageToHP: 0,
    damageToArmor: dmg,
    armorBroken: nextarmorDurability <= 0,
    prevArmorarmorDurability: armorarmorDurability,
    nextArmorarmorDurability: nextarmorDurability,
    armor,
    slot: useSlot,
  };
}

const SLOT_PRIORITY = ["chest", "torso", "arms", "legs", "head", "cloak", "shield"];

export function pickPrimaryArmorSlot(defender, preferredSlot) {
  if (typeof preferredSlot === "string" && preferredSlot) return preferredSlot;
  const eq = defender?.equistaminad || {};
  for (const s of SLOT_PRIORITY) {
    const a = eq[s];
    const guardRating = Number(a?.guardRating ?? a?.guardRating ?? a?.guardRating ?? a?.defense ?? 0) || 0;
    let sd = Number(a?.currentarmorDurability);
    if (!Number.isFinite(sd)) sd = Number(a?.armorDurability ?? 0) || 0;
    if (a && guardRating > 0 && sd > 0) return s;
  }
  for (const s of Object.keys(eq)) {
    const a = eq[s];
    const guardRating = Number(a?.guardRating ?? a?.guardRating ?? a?.guardRating ?? a?.defense ?? 0) || 0;
    let sd = Number(a?.currentarmorDurability);
    if (!Number.isFinite(sd)) sd = Number(a?.armorDurability ?? 0) || 0;
    if (a && guardRating > 0 && sd > 0) return s;
  }
  return "chest";
}

export function attackConnectsVsTarget({
  defender,
  attackTotal,
  d20,
  slot = "chest",
  ruleset = null,
  critOn = 20,
  alwaysMissOn = 1,
}) {
  const isFumble = ruleset?.isFumble ? !!ruleset.isFumble(d20) : d20 === Number(alwaysMissOn);
  if (isFumble) return { connects: false, isCrit: false, isFumble: true };

  const isCrit = ruleset?.isCrit ? !!ruleset.isCrit(d20) : d20 >= Number(critOn);
  const useSlot = pickPrimaryArmorSlot(defender, slot);
  const impact = resolveWeaponImpactVsArmor({
    defender,
    attackTotal,
    damage: 0,
    slot: useSlot,
    isCrit,
    isFumble: false,
  });
  return {
    connects: impact.outcome !== "miss",
    isCrit,
    isFumble: false,
    outcome: impact.outcome,
    slot: useSlot,
  };
}
