import { getArmorStaminaBurden, spendStamina } from "./combatStamina.js";

export const SURVIVAL_INTENTS = Object.freeze({
  HOLD: "hold",
  ATTACK: "attack",
  REGROUP_WITH_ALLY: "regroup-with-ally",
  FALL_BACK_TO_LEADER: "fall-back-to-leader",
  WITHDRAW_TO_TEAM_CENTER: "withdraw-to-team-center",
  HIDE_BEHIND_STRONGEST_ALLY: "hide-behind-strongest-ally",
  DEFENSIVE_BACKSTEP: "defensive-backstep",
  PANIC_FLEE_TO_EDGE: "panic-flee-to-edge",
  COWER: "cower",
  SURRENDER: "surrender",
});

export const SURVIVAL_INTENT_THRESHOLDS = Object.freeze({
  panic: 8,
  isolatedPanic: 5,
  badlyWoundedHpRatio: 0.2,
  freshStaminaRatio: 0.75,
  tiredStaminaRatio: 0.2,
  windedStaminaRatio: 0.4,
});

const SURVIVAL_INTENT_VALUES = new Set(Object.values(SURVIVAL_INTENTS));

export function normalizeSurvivalIntent(intent, fallback = SURVIVAL_INTENTS.HOLD) {
  return SURVIVAL_INTENT_VALUES.has(intent) ? intent : fallback;
}

const finiteNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const firstFiniteNumber = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined || value === "" || typeof value === "boolean") continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
};

export function getStaminaRoutingProfile(fighter = {}) {
  const max = firstFiniteNumber(
    fighter.maxStamina,
    fighter.staminaMax,
    fighter.maxstamina,
    fighter.combatStamina?.maxStamina,
    fighter.fatigueState?.maxStamina,
  );
  const current = firstFiniteNumber(
    fighter.currentStamina,
    fighter.staminaCurrent,
    fighter.currentstamina,
    fighter.combatStamina?.currentStamina,
    fighter.fatigueState?.currentStamina,
    fighter.stamina,
  );
  const hasExplicitStamina = max !== null && max > 0;
  const normalizedMax = hasExplicitStamina ? max : Math.max(1, current ?? 1);
  const normalizedCurrent = Math.max(0, Math.min(normalizedMax, current ?? normalizedMax));
  const ratio = normalizedCurrent / normalizedMax;

  if (ratio >= SURVIVAL_INTENT_THRESHOLDS.freshStaminaRatio) {
    return { band: "fresh", panicModifier: -1, current: normalizedCurrent, max: normalizedMax, ratio, hasExplicitStamina };
  }
  if (ratio >= SURVIVAL_INTENT_THRESHOLDS.windedStaminaRatio) {
    return { band: "winded", panicModifier: 0, current: normalizedCurrent, max: normalizedMax, ratio, hasExplicitStamina };
  }
  if (ratio >= SURVIVAL_INTENT_THRESHOLDS.tiredStaminaRatio) {
    return { band: "tired", panicModifier: 2, current: normalizedCurrent, max: normalizedMax, ratio, hasExplicitStamina };
  }
  return { band: "exhausted", panicModifier: 4, current: normalizedCurrent, max: normalizedMax, ratio, hasExplicitStamina };
}

export function getRoutingArmorProfile(fighter = {}) {
  const armorText = [
    fighter.armorProfile?.weightClass,
    fighter.armorProfile?.category,
    fighter.armor?.weightClass,
    fighter.armor?.category,
    fighter.armor?.type,
    fighter.equistaminadArmor,
    fighter.equippedArmor,
    fighter.armorName,
  ].filter(Boolean).join(" ").toLowerCase();
  const legacyArmorClass = firstFiniteNumber(
    fighter.armorClass,
    fighter.ac,
    fighter.guardRating,
    fighter.derivedStats?.armorClass,
  );
  const heavy = /heavy|plate|brigandine|coat of plates/.test(armorText) || (legacyArmorClass !== null && legacyArmorClass >= 16);
  const medium = !heavy && (/medium|mail|chain|scale/.test(armorText) || (legacyArmorClass !== null && legacyArmorClass >= 13));
  return {
    band: heavy ? "heavy" : medium ? "medium" : armorText ? "light" : "unarmored",
    heavy,
    physicalPanicRelief: heavy ? 1 : 0,
    mythicPanicRelief: heavy ? 1 : 0,
    source: armorText ? "armor-data" : legacyArmorClass !== null ? "legacy-armor-class" : "none",
  };
}

export function calculateRoutedMovementStaminaCost({
  fighter = {},
  distanceFeet = 0,
  movementType = "controlled",
  survivalIntent = SURVIVAL_INTENTS.HOLD,
  armorProfile = getRoutingArmorProfile(fighter),
} = {}) {
  const distance = Math.max(0, finiteNumber(distanceFeet));
  const panicRunning = survivalIntent === SURVIVAL_INTENTS.PANIC_FLEE_TO_EDGE || /panic|run/i.test(String(movementType));
  const armorBurden = getArmorStaminaBurden(fighter, armorProfile);
  if (panicRunning) {
    return 3 +
      armorBurden.panicMovePenalty +
      armorBurden.shieldPenalty +
      (distance >= 60 ? 1 + armorBurden.longMovePenalty : 0);
  }
  const controlledBase = survivalIntent === SURVIVAL_INTENTS.DEFENSIVE_BACKSTEP
    ? 1
    : distance > 30 ? 2 : 1;
  return controlledBase +
    armorBurden.controlledMovePenalty +
    (distance >= 60 ? armorBurden.longMovePenalty : 0);
}

/**
 * Apply the existing panic-movement stamina cost only after real movement has
 * been selected under the active action token.
 */
export function resolvePanicFleeStaminaSpend({
  fighter = {},
  distanceFeet = 0,
  movementCommitted = false,
  actionToken = null,
  activeActionToken = null,
  armorProfile = getRoutingArmorProfile(fighter),
} = {}) {
  if (!movementCommitted || !(Number(distanceFeet) > 0)) {
    return {
      accepted: false,
      reason: "no-movement-committed",
      cost: 0,
      spent: 0,
      updated: fighter,
    };
  }
  if (!actionToken || !activeActionToken || actionToken !== activeActionToken) {
    return {
      accepted: false,
      reason: "stale-action-token",
      cost: 0,
      spent: 0,
      updated: fighter,
    };
  }
  const cost = calculateRoutedMovementStaminaCost({
    fighter,
    distanceFeet,
    movementType: "panic-run",
    survivalIntent: SURVIVAL_INTENTS.PANIC_FLEE_TO_EDGE,
    armorProfile,
  });
  const result = spendStamina(fighter, cost);
  return {
    accepted: result.ok,
    reason: result.ok ? null : "stamina-spend-rejected",
    actionToken,
    cost,
    spent: result.spent,
    updated: result.updated,
  };
}

/**
 * Convert morale pressure into a survival behavior. This deliberately does not
 * decide whether morale failed; it only decides what an already-pressured actor
 * tries to do next.
 */
export function chooseSurvivalIntent({
  fighter = {},
  moraleFailureMargin = 0,
  routed = false,
  badlyWounded = false,
  isolated = false,
  adjacentThreats = 0,
  nearbyAllies = [],
  nearbyLeader = null,
  teamCenter = null,
  strongestAlly = null,
  mythicTerror = false,
  terrorPressure = 0,
  resolveRelief = 0,
} = {}) {
  const moraleState = String(
    fighter?.state?.moraleState || fighter?.moraleState?.status || ""
  ).toLowerCase();
  const trulyBroken = moraleState === "broken";
  const allyCount = Array.isArray(nearbyAllies) ? nearbyAllies.length : 0;
  const staminaProfile = getStaminaRoutingProfile(fighter);
  const armorProfile = getRoutingArmorProfile(fighter);
  const armorPanicRelief = mythicTerror
    ? armorProfile.mythicPanicRelief
    : armorProfile.physicalPanicRelief;
  const panicScore = Math.max(0,
    finiteNumber(moraleFailureMargin) +
    (mythicTerror ? 10 : finiteNumber(terrorPressure)) +
    staminaProfile.panicModifier +
    (badlyWounded ? 3 : 0) +
    (isolated ? 3 : 0) +
    Math.min(4, Math.max(0, finiteNumber(adjacentThreats)) * 2) +
    (trulyBroken ? 8 : 0) -
    Math.min(3, allyCount) -
    (nearbyLeader ? 3 : 0) -
    (teamCenter ? 1 : 0) -
    armorPanicRelief -
    Math.max(0, finiteNumber(resolveRelief))
  );

  let intent;
  if (
    panicScore >= SURVIVAL_INTENT_THRESHOLDS.panic ||
    (isolated && panicScore >= SURVIVAL_INTENT_THRESHOLDS.isolatedPanic)
  ) {
    intent = SURVIVAL_INTENTS.PANIC_FLEE_TO_EDGE;
  } else if (nearbyLeader) {
    intent = SURVIVAL_INTENTS.FALL_BACK_TO_LEADER;
  } else if (allyCount > 0) {
    intent = SURVIVAL_INTENTS.REGROUP_WITH_ALLY;
  } else if (teamCenter) {
    intent = SURVIVAL_INTENTS.WITHDRAW_TO_TEAM_CENTER;
  } else if (strongestAlly && (badlyWounded || isolated)) {
    intent = SURVIVAL_INTENTS.HIDE_BEHIND_STRONGEST_ALLY;
  } else if (routed) {
    intent = SURVIVAL_INTENTS.DEFENSIVE_BACKSTEP;
  } else {
    intent = SURVIVAL_INTENTS.HOLD;
  }

  return { intent, panicScore, trulyBroken, staminaProfile, armorProfile, armorPanicRelief };
}

export function formatSurvivalIntent(intent) {
  const normalized = normalizeSurvivalIntent(intent);
  return {
    [SURVIVAL_INTENTS.REGROUP_WITH_ALLY]: "regroup with nearest ally",
    [SURVIVAL_INTENTS.FALL_BACK_TO_LEADER]: "fall back to leader",
    [SURVIVAL_INTENTS.WITHDRAW_TO_TEAM_CENTER]: "withdraw to team center",
    [SURVIVAL_INTENTS.HIDE_BEHIND_STRONGEST_ALLY]: "hide behind strongest ally",
    [SURVIVAL_INTENTS.DEFENSIVE_BACKSTEP]: "defensive backstep",
    [SURVIVAL_INTENTS.PANIC_FLEE_TO_EDGE]: "panic flee to edge",
  }[normalized] || normalized.replaceAll("-", " ");
}
