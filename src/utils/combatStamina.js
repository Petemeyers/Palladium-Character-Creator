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

const modifierFromScore = (score) => {
  const number = toNumber(score);
  return number === null ? null : Math.floor((number - 10) / 2);
};

const getConstitutionModifier = (combatant = {}) => {
  const explicitModifier = firstNumber(
    combatant.abilityModifiers?.con,
    combatant.publicAbilityModifiers?.con,
    combatant.autoRollCharacter?.abilityModifiers?.con,
    combatant.autoRollCharacter?.publicAbilityModifiers?.con,
    combatant.publicDerivedStats?.abilityModifiers?.con,
    combatant.publicEnemyMetadata?.abilityModifiers?.con
  );
  if (explicitModifier !== null) return explicitModifier;

  const constitutionScore = firstNumber(
    combatant.finalAbilityScores?.con,
    combatant.publicAbilityScores?.con,
    combatant.abilityScores?.con,
    combatant.autoRollCharacter?.finalAbilityScores?.con,
    combatant.autoRollCharacter?.publicAbilityScores?.con,
    combatant.autoRollCharacter?.abilityScores?.con,
    combatant.publicEnemyMetadata?.abilityScores?.con
  );
  const publicModifier = modifierFromScore(constitutionScore);
  if (publicModifier !== null) return publicModifier;

  return modifierFromScore(firstNumber(
    combatant.compatibilityAttributes?.PE,
    combatant.attributes?.PE,
    combatant.PE,
    combatant.autoRollCharacter?.compatibilityAttributes?.PE,
    combatant.autoRollCharacter?.attributes?.PE,
    combatant.autoRollCharacter?.PE
  ));
};

export function getFatigueLabel(currentStamina, maxStamina) {
  const current = Math.max(0, toNumber(currentStamina) ?? 0);
  const max = Math.max(1, toNumber(maxStamina) ?? 1);

  if (current <= 0) return "Exhausted";
  if (current <= max / 2) return "Winded";
  return "Fresh";
}

export function getDefaultStamina(combatant = {}) {
  const constitutionModifier = getConstitutionModifier(combatant);
  return Math.max(1, 10 + (constitutionModifier ?? 0));
}

export function initializeStamina(combatant = {}) {
  const maxStamina = getDefaultStamina(combatant);

  return {
    ...combatant,
    maxStamina,
    currentStamina: maxStamina,
    fatigueLabel: getFatigueLabel(maxStamina, maxStamina),
  };
}

export function getStaminaState(combatantOrTurnEntry = {}) {
  const maxStamina = Math.max(1, firstNumber(
    combatantOrTurnEntry?.maxStamina,
    combatantOrTurnEntry?.staminaMax,
    combatantOrTurnEntry?.maxstamina,
    combatantOrTurnEntry?.combatStamina?.maxStamina,
    combatantOrTurnEntry?.fatigueState?.maxStamina,
  ) ?? getDefaultStamina(combatantOrTurnEntry));
  const currentStamina = Math.max(
    0,
    Math.min(maxStamina, firstNumber(
      combatantOrTurnEntry?.currentStamina,
      combatantOrTurnEntry?.staminaCurrent,
      combatantOrTurnEntry?.currentstamina,
      combatantOrTurnEntry?.combatStamina?.currentStamina,
      combatantOrTurnEntry?.fatigueState?.currentStamina,
    ) ?? maxStamina)
  );

  return {
    maxStamina,
    currentStamina,
    fatigueLabel: getFatigueLabel(currentStamina, maxStamina),
  };
}

export function getArmorStaminaBurden(fighter = {}, armorProfile = {}) {
  const armorBand = String(armorProfile.band || armorProfile.armorClass || "none").toLowerCase();
  const medium = armorBand === "medium";
  const heavy = armorProfile.heavy === true || armorBand === "heavy";
  const equipmentText = [
    fighter.shield,
    fighter.equippedShield,
    fighter.offHand,
    ...(Array.isArray(fighter.equipment) ? fighter.equipment.map((item) => item?.name || item?.type || item) : []),
  ].filter(Boolean).join(" ").toLowerCase();
  const carriesShield = fighter.hasShield === true || /shield|buckler/.test(equipmentText);

  return {
    armorClass: heavy ? "heavy" : medium ? "medium" : armorBand === "light" ? "light" : "none",
    controlledMovePenalty: heavy ? 1 : 0,
    panicMovePenalty: heavy ? 2 : medium ? 1 : 0,
    longMovePenalty: heavy || medium ? 1 : 0,
    shieldPenalty: carriesShield ? 1 : 0,
  };
}

const normalizedText = (...values) => values.filter(Boolean).join(" ").toLowerCase();

export function calculateAttackStaminaCost({ fighter = {}, weapon = {}, attackType = "" } = {}) {
  const text = normalizedText(
    attackType,
    weapon?.name,
    weapon?.type,
    weapon?.attackType,
    weapon?.kind,
    weapon?.category,
    weapon?.weaponType,
  );
  const isRanged = weapon?.isRanged === true || weapon?.range != null || weapon?.rangeFeet != null ||
    /ranged|bow|crossbow|sling|thrown|projectile/.test(text);
  if (isRanged) return 1;
  if (/grapple|shove|shield bash|bash/.test(text)) return 2;
  const isHeavy = weapon?.heavy === true || weapon?.twoHanded === true || weapon?.isTwoHanded === true ||
    Number(weapon?.weight) >= 8 || /heavy|two-handed|two handed|great\s*sword|great\s*axe|maul|polearm/.test(text);
  if (isHeavy) return 3;
  const isLight = weapon?.light === true || weapon?.finesse === true ||
    /light|dagger|knife|unarmed|claw|bite/.test(text);
  if (isLight) return 1;
  return fighter?.isTiny ? 1 : 2;
}

export function calculateDefenseStaminaCost({
  defender = {},
  defenseType = "block",
  attackResult = {},
  weapon = {},
} = {}) {
  const condition = normalizedText(defender?.status, defender?.condition);
  const hp = firstNumber(defender?.currentHP, defender?.HP, defender?.hp, defender?.hitPoints);
  if (defender?.isDead || defender?.isKO || (hp !== null && hp <= 0) || /dead|unconscious|dying/.test(condition)) return 0;
  const type = normalizedText(defenseType);
  let cost = /evade|dodge|move/.test(type) ? 2 : 1;
  const heavyImpact = attackResult?.critical === true || attackResult?.isCriticalHit === true ||
    attackResult?.heavy === true || weapon?.heavy === true || weapon?.twoHanded === true ||
    /heavy|two-handed|two handed|greatsword|greataxe|maul/.test(normalizedText(weapon?.name, weapon?.type, weapon?.category));
  if (heavyImpact) cost += 1;
  return cost;
}

export function calculateRecoveryStamina({ recoveryType = "recover" } = {}) {
  return /defend|posture|guard/.test(normalizedText(recoveryType)) ? 1 : 3;
}

export function chooseAIStaminaRecovery({
  fighter = {},
  enemies = [],
  allies = [],
  positions = {},
  calculateDistance,
  canFinishEnemy = false,
  routed = false,
} = {}) {
  const stamina = getStaminaState(fighter);
  if (routed) return { shouldRecover: false, reason: "survival-routing", stamina };
  if (canFinishEnemy) return { shouldRecover: false, reason: "finishing-opportunity", stamina };
  const armorText = normalizedText(
    fighter?.armorType,
    fighter?.armor?.type,
    fighter?.equippedArmor?.type,
    fighter?.equippedArmor?.name,
  );
  const heavyArmor = fighter?.armorProfile?.heavy === true || /heavy|plate/.test(armorText);
  const recoveryThreshold = Math.max(3, Math.ceil(stamina.maxStamina * (heavyArmor ? 0.5 : 0.4)));
  if (stamina.currentStamina >= recoveryThreshold) {
    return { shouldRecover: false, reason: "stamina-sufficient", stamina };
  }
  const fighterPos = positions?.[fighter?.id];
  if ((Array.isArray(enemies) ? enemies.length : 0) > 0 && (!fighterPos || typeof calculateDistance !== "function")) {
    return { shouldRecover: false, reason: "threat-distance-unknown", stamina };
  }
  const distanceTo = (actor) => {
    if (!fighterPos || !positions?.[actor?.id] || typeof calculateDistance !== "function") return Infinity;
    return Number(calculateDistance(fighterPos, positions[actor.id]));
  };
  const adjacentThreat = (Array.isArray(enemies) ? enemies : []).find((enemy) => distanceTo(enemy) <= 5.01);
  if (adjacentThreat) return { shouldRecover: false, reason: "adjacent-threat", threat: adjacentThreat, stamina };
  const nearbyAlly = (Array.isArray(allies) ? allies : []).find((ally) => distanceTo(ally) <= 30.01) || null;
  return {
    shouldRecover: true,
    reason: nearbyAlly ? "low-stamina-covered" : "low-stamina-safe-distance",
    nearbyAlly,
    stamina,
  };
}

export const ROUTED_MOVEMENT_MULTIPLIERS = Object.freeze({
  fresh: { walk: 1, run: 1, panic: 1 },
  winded: { walk: 1, run: 0.85, panic: 0.85 },
  tired: { walk: 0.85, run: 0.65, panic: 0.65 },
  exhausted: { walk: 0.65, run: 0.4, panic: 0.5 },
  spent: { walk: 0.4, run: 0, panic: 0 },
});

export function calculateEffectiveRoutedMovement({
  fighter = {},
  baseDistanceFeet = 0,
  movementType = "walk",
  staminaProfile = {},
  armorProfile = {},
} = {}) {
  const staminaState = getStaminaState(fighter);
  const band = staminaState.currentStamina <= 0
    ? "spent"
    : String(staminaProfile.band || "fresh").toLowerCase();
  const kind = /panic/i.test(movementType) ? "panic" : /run/i.test(movementType) ? "run" : "walk";
  const baseMultiplier = ROUTED_MOVEMENT_MULTIPLIERS[band]?.[kind] ?? 1;
  const armorBand = String(armorProfile.band || "none").toLowerCase();
  const lowStamina = ["winded", "tired", "exhausted", "spent"].includes(band);
  let armorMultiplier = 1;
  if (lowStamina && armorBand === "heavy") armorMultiplier = band === "winded" ? 0.9 : 0.8;
  else if (["tired", "exhausted", "spent"].includes(band) && armorBand === "medium") armorMultiplier = 0.9;
  const rawDistance = Math.max(0, Number(baseDistanceFeet) || 0) * baseMultiplier * armorMultiplier;
  const distanceFeet = rawDistance <= 0 ? 0 : Math.max(5, Math.floor(rawDistance / 5) * 5);
  return {
    distanceFeet,
    multiplier: baseMultiplier * armorMultiplier,
    reason: band === "spent" ? "spent-stamina" : lowStamina ? `${band}-stamina` : "full-stamina",
    exhausted: ["exhausted", "spent"].includes(band),
    spent: band === "spent",
    armorPenaltyApplied: armorMultiplier < 1,
    band,
  };
}

export function spendStamina(combatantOrTurnEntry = {}, cost = 1) {
  const state = getStaminaState(combatantOrTurnEntry);
  const staminaCost = Math.max(1, toNumber(cost) ?? 1);
  const nextStamina = Math.max(0, state.currentStamina - staminaCost);
  const spent = state.currentStamina - nextStamina;
  const fatigueLabel = getFatigueLabel(nextStamina, state.maxStamina);
  const updated = {
    ...combatantOrTurnEntry,
    maxStamina: state.maxStamina,
    currentStamina: nextStamina,
    fatigueLabel,
    ...(combatantOrTurnEntry.combatStamina ? {
      combatStamina: {
        ...combatantOrTurnEntry.combatStamina,
        maxStamina: state.maxStamina,
        currentStamina: nextStamina,
        fatigueLabel,
      },
    } : {}),
    ...(combatantOrTurnEntry.fatigueState ? {
      fatigueState: {
        ...combatantOrTurnEntry.fatigueState,
        maxStamina: state.maxStamina,
        currentStamina: nextStamina,
      },
    } : {}),
    ...(Object.hasOwn(combatantOrTurnEntry, "maxstamina") ? { maxstamina: state.maxStamina } : {}),
    ...(Object.hasOwn(combatantOrTurnEntry, "currentstamina") ? { currentstamina: nextStamina } : {}),
  };

  return {
    ok: spent > 0,
    updated,
    spent,
    maxStamina: state.maxStamina,
    currentStamina: nextStamina,
    fatigueLabel,
    missingFields: spent > 0 ? [] : ["currentStamina"],
  };
}

export function resetStaminaForEncounter(combatantOrTurnEntry = {}) {
  return initializeStamina(combatantOrTurnEntry);
}

export default {
  calculateAttackStaminaCost,
  calculateDefenseStaminaCost,
  calculateEffectiveRoutedMovement,
  calculateRecoveryStamina,
  chooseAIStaminaRecovery,
  getArmorStaminaBurden,
  getDefaultStamina,
  getFatigueLabel,
  getStaminaState,
  initializeStamina,
  resetStaminaForEncounter,
  spendStamina,
};
