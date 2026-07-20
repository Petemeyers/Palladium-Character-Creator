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

const clampFinite = (value, min, max) => {
  const numeric = toNumber(value);
  if (numeric === null) return null;
  return Math.max(min, Math.min(max, numeric));
};

const currentStaminaIsAuthoritative = (combatant = {}, field = "") => {
  const authority = String(combatant.staminaAuthority || combatant.combatStamina?.authority || "").toLowerCase();
  if (field === "combatStamina.currentStamina") return true;
  if (field === "currentStamina") return true;
  if (field === "fatigueState.currentStamina") {
    return ["combat-stamina", "fatigue-state", "statblock", "explicit"].includes(authority) ||
      combatant.fatigueState?.authority === "combat-stamina";
  }
  return ["combat-stamina", "statblock", "explicit", "legacy-current"].includes(authority) ||
    combatant.staminaConfigured === true ||
    combatant.explicitStamina === true;
};

function findCanonicalCurrentStamina(combatant = {}, maxStamina) {
  const candidates = [
    ["combatStamina.currentStamina", combatant.combatStamina?.currentStamina],
    ["currentStamina", combatant.currentStamina],
    ["fatigueState.currentStamina", combatant.fatigueState?.currentStamina],
    ["currentstamina", combatant.currentstamina],
    ["staminaCurrent", combatant.staminaCurrent],
    ["training.currentstamina", combatant.training?.currentstamina],
  ];
  for (const [field, value] of candidates) {
    if (!currentStaminaIsAuthoritative(combatant, field)) continue;
    const current = clampFinite(value, 0, maxStamina);
    if (current !== null) return { currentStamina: current, source: field };
  }
  return { currentStamina: maxStamina, source: "maxStamina" };
}

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

const getCreatureFallbackStamina = (combatant = {}) => {
  const size = String(
    combatant.size || combatant.sizeCategory || combatant.creatureSize || "medium"
  ).toLowerCase();
  const descriptors = [
    combatant.category,
    combatant.creatureType,
    combatant.aiRole,
    ...(Array.isArray(combatant.tags) ? combatant.tags : []),
  ].map((value) => String(value || "").toLowerCase());

  if (["large", "huge", "gargantuan", "colossal"].some((value) => size.includes(value)) ||
      descriptors.some((value) => ["mythic", "giant", "brute"].includes(value))) {
    return 30;
  }
  if (["tiny", "small"].some((value) => size.includes(value)) ||
      descriptors.some((value) => ["small", "weak"].includes(value))) {
    return 12;
  }
  return 20;
};

/**
 * Resolve the encounter-fatigue pool used by the legacy combat runtime.
 * Explicit stamina wins, then the public Endurance/legacy PE rule (score x 2),
 * then a size-aware creature fallback. Nested one-point fatigue state is treated
 * as a stale normalization sentinel unless the actor deliberately declares a
 * one-point pool on a top-level canonical field.
 */
export function resolveEncounterStamina(combatant = {}) {
  const explicitMax = firstNumber(
    combatant.maxStamina,
    combatant.staminaMax,
    combatant.maxstamina,
    combatant.combatStamina?.maxStamina,
  );
  const deliberatelyConfigured = combatant.staminaConfigured === true ||
    combatant.explicitStamina === true ||
    String(combatant.staminaAuthority || "").toLowerCase() === "statblock";
  if (explicitMax !== null && (explicitMax > 1 || deliberatelyConfigured)) {
    return { maxStamina: explicitMax, source: "explicit", usedFallback: false };
  }

  const endurance = firstNumber(
    combatant.finalAttributes?.endurance,
    combatant.publicAttributes?.endurance,
    combatant.attributes?.endurance,
    combatant.actorProfile?.attributes?.endurance,
    combatant.originalActorMetadata?.attributes?.endurance,
  );
  if (endurance !== null && endurance > 0) {
    return { maxStamina: endurance * 2, source: "endurance", usedFallback: false };
  }

  const physicalEndurance = firstNumber(
    combatant.PE,
    combatant.pe,
    combatant.attributes?.PE,
    combatant.attributes?.pe,
    combatant.stats?.PE,
    combatant.stats?.pe,
    combatant.compatibilityAttributes?.PE,
    combatant.compatibilityAttributes?.pe,
  );
  if (physicalEndurance !== null && physicalEndurance > 0) {
    return { maxStamina: physicalEndurance * 2, source: "physical-endurance", usedFallback: false };
  }

  const nestedMax = firstNumber(combatant.fatigueState?.maxStamina);
  if (nestedMax !== null && nestedMax > 1) {
    return { maxStamina: nestedMax, source: "existing-fatigue-state", usedFallback: false };
  }

  return {
    maxStamina: getCreatureFallbackStamina(combatant),
    source: "creature-fallback",
    usedFallback: true,
  };
}

export function mirrorCombatStaminaCompatibilityFields(fighter = {}, value, maxValue = undefined) {
  const maxStamina = Math.max(0, toNumber(maxValue) ?? toNumber(fighter.combatStamina?.maxStamina) ?? toNumber(fighter.maxStamina) ?? value ?? 0);
  const currentStamina = Math.max(0, Math.min(maxStamina, toNumber(value) ?? maxStamina));
  return {
    ...fighter,
    maxStamina,
    currentStamina,
    currentstamina: currentStamina,
    staminaAuthority: "combat-stamina",
    staminaCurrent: currentStamina,
    combatStamina: {
      ...(fighter.combatStamina || {}),
      maxStamina,
      currentStamina,
      authority: "combat-stamina",
    },
    fatigueState: {
      ...(fighter.fatigueState || {}),
      maxStamina,
      currentStamina,
      authority: "combat-stamina",
    },
    ...(!Array.isArray(fighter.training) && fighter.training
      ? { training: { ...fighter.training, currentstamina: currentStamina } }
      : {}),
  };
}

export function initializeCombatStamina(fighter = {}) {
  const resolved = resolveEncounterStamina(fighter);
  const maxStamina = Math.max(0, toNumber(fighter.combatStamina?.maxStamina) ?? resolved.maxStamina ?? 0);
  const current = findCanonicalCurrentStamina(fighter, maxStamina);
  const initialized = mirrorCombatStaminaCompatibilityFields(fighter, current.currentStamina, maxStamina);
  return {
    ...initialized,
    fatigueLabel: getFatigueLabel(current.currentStamina, maxStamina),
    combatStamina: {
      ...(initialized.combatStamina || {}),
      initialized: true,
      currentSource: current.source,
    },
  };
}

export function readCombatStamina(fighter = {}) {
  const initialized = initializeCombatStamina(fighter);
  const maxStamina = toNumber(initialized.combatStamina?.maxStamina);
  const currentStamina = toNumber(initialized.combatStamina?.currentStamina);
  const valid = maxStamina !== null && currentStamina !== null && currentStamina >= 0 && currentStamina <= maxStamina;
  return {
    valid,
    maxStamina,
    currentStamina,
    authority: initialized.combatStamina?.authority || "combat-stamina",
    fighter: initialized,
    reason: valid ? null : "invalid-canonical-stamina",
  };
}

export function spendCombatStamina({
  fighter = {},
  amount = 0,
  reason = "unknown",
  allowOverexertion = false,
} = {}) {
  const state = readCombatStamina(fighter);
  const requestedSpend = toNumber(amount);
  if (!state.valid || requestedSpend === null || requestedSpend < 0) {
    return {
      accepted: false,
      reason: "invalid-canonical-stamina",
      previousStamina: state.currentStamina,
      requestedSpend: requestedSpend ?? null,
      appliedSpend: null,
      spent: 0,
      nextStamina: null,
      maxStamina: state.maxStamina,
      currentStamina: state.currentStamina,
      updated: state.fighter,
      insufficientStamina: false,
      overexertionApplied: false,
    };
  }
  const insufficientStamina = state.currentStamina < requestedSpend;
  const accepted = !insufficientStamina || allowOverexertion;
  if (!accepted) {
    return {
      accepted: false,
      reason: "insufficient-stamina",
      previousStamina: state.currentStamina,
      requestedSpend,
      appliedSpend: 0,
      spent: 0,
      nextStamina: state.currentStamina,
      maxStamina: state.maxStamina,
      currentStamina: state.currentStamina,
      updated: state.fighter,
      insufficientStamina,
      overexertionApplied: false,
    };
  }
  const appliedSpend = Math.min(state.currentStamina, requestedSpend);
  const nextStamina = Math.max(0, state.currentStamina - appliedSpend);
  if (!Number.isFinite(nextStamina)) {
    return {
      accepted: false,
      reason: "invalid-canonical-stamina",
      previousStamina: state.currentStamina,
      requestedSpend,
      appliedSpend,
      spent: 0,
      nextStamina: null,
      maxStamina: state.maxStamina,
      currentStamina: state.currentStamina,
      updated: state.fighter,
      insufficientStamina,
      overexertionApplied: false,
    };
  }
  const updated = {
    ...mirrorCombatStaminaCompatibilityFields(state.fighter, nextStamina, state.maxStamina),
    fatigueLabel: getFatigueLabel(nextStamina, state.maxStamina),
  };
  return {
    accepted: true,
    reason,
    previousStamina: state.currentStamina,
    requestedSpend,
    appliedSpend,
    spent: appliedSpend,
    nextStamina,
    maxStamina: state.maxStamina,
    currentStamina: nextStamina,
    updated,
    insufficientStamina,
    overexertionApplied: insufficientStamina && allowOverexertion,
    overexertionActions: insufficientStamina && allowOverexertion ? 1 : 0,
  };
}

export function recoverCombatStamina({ fighter = {}, amount = 0, reason = "recovery" } = {}) {
  const state = readCombatStamina(fighter);
  const recovery = toNumber(amount);
  if (!state.valid || recovery === null || recovery < 0) {
    return { accepted: false, reason: "invalid-canonical-stamina", updated: state.fighter };
  }
  const nextStamina = Math.min(state.maxStamina, state.currentStamina + recovery);
  const updated = {
    ...mirrorCombatStaminaCompatibilityFields(state.fighter, nextStamina, state.maxStamina),
    fatigueLabel: getFatigueLabel(nextStamina, state.maxStamina),
  };
  return {
    accepted: true,
    reason,
    previousStamina: state.currentStamina,
    recovered: nextStamina - state.currentStamina,
    nextStamina,
    maxStamina: state.maxStamina,
    currentStamina: nextStamina,
    updated,
  };
}

export function getFatigueLabel(currentStamina, maxStamina) {
  const current = Math.max(0, toNumber(currentStamina) ?? 0);
  const max = Math.max(1, toNumber(maxStamina) ?? 1);

  if (current <= 0) return "Exhausted";
  if (current <= max / 2) return "Winded";
  return "Fresh";
}

export function getDefaultStamina(combatant = {}) {
  const encounterStamina = resolveEncounterStamina(combatant);
  if (
    combatant.normalizedSelectableActor === true ||
    encounterStamina.source === "explicit" ||
    encounterStamina.source === "endurance"
  ) {
    return encounterStamina.maxStamina;
  }
  const constitutionModifier = getConstitutionModifier(combatant);
  return Math.max(1, 10 + (constitutionModifier ?? 0));
}

export function initializeStamina(combatant = {}) {
  const maxStamina = getDefaultStamina(combatant);
  return initializeCombatStamina({
    ...combatant,
    maxStamina,
  });
}

export function getStaminaState(combatantOrTurnEntry = {}) {
  const state = readCombatStamina(combatantOrTurnEntry);
  const maxStamina = Math.max(1, state.maxStamina ?? getDefaultStamina(combatantOrTurnEntry));
  const currentStamina = Math.max(0, Math.min(maxStamina, state.currentStamina ?? maxStamina));

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
  initializeCombatStamina,
  initializeStamina,
  mirrorCombatStaminaCompatibilityFields,
  readCombatStamina,
  recoverCombatStamina,
  resetStaminaForEncounter,
  spendCombatStamina,
  spendStamina,
};
