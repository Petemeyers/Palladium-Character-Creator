const finite = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const firstFinite = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null || value === "" || typeof value === "boolean") continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
};

export const EXERTION_BANDS = Object.freeze({
  FRESH: "fresh",
  WINDED: "winded",
  EXHAUSTED: "exhausted",
  OVEREXERTED: "overexerted",
  SEVERE: "severe-exhaustion",
  CRITICAL: "critical-exhaustion",
  COLLAPSE_RISK: "collapse-risk",
  COLLAPSED: "collapsed",
});

export function getStaminaDebtFloor(maxStamina = 0) {
  return -Math.max(1, finite(maxStamina, 1));
}

export function getExertionProfile(currentStamina = 0, maxStamina = 1) {
  const max = Math.max(1, finite(maxStamina, 1));
  const floor = getStaminaDebtFloor(max);
  const current = Math.max(floor, Math.min(max, finite(currentStamina, max)));
  const positiveRatio = Math.max(0, current) / max;
  const debt = Math.max(0, -current);
  const debtRatio = Math.min(1, debt / max);

  let band;
  let label;
  let penalties;
  let collapseCheckRequired = false;
  let forcedCollapse = false;

  if (current > max * 0.5) {
    band = EXERTION_BANDS.FRESH;
    label = "Fresh";
    penalties = { attack: 0, block: 0, evade: 0, ps: 0, speed: 1 };
  } else if (current > 0) {
    band = EXERTION_BANDS.WINDED;
    label = "Winded";
    penalties = { attack: 0, block: 0, evade: 0, ps: 0, speed: 0.95 };
  } else if (current === 0) {
    band = EXERTION_BANDS.EXHAUSTED;
    label = "Exhausted";
    penalties = { attack: -1, block: -1, evade: -1, ps: 0, speed: 0.9 };
  } else if (debtRatio <= 0.25) {
    band = EXERTION_BANDS.OVEREXERTED;
    label = "Overexerted";
    penalties = { attack: -1, block: -1, evade: -2, ps: -1, speed: 0.85 };
  } else if (debtRatio <= 0.5) {
    band = EXERTION_BANDS.SEVERE;
    label = "Severely Exhausted";
    penalties = { attack: -2, block: -2, evade: -3, ps: -2, speed: 0.7 };
    collapseCheckRequired = debtRatio >= 0.4;
  } else if (debtRatio <= 0.75) {
    band = EXERTION_BANDS.CRITICAL;
    label = "Critically Exhausted";
    penalties = { attack: -4, block: -3, evade: -4, ps: -3, speed: 0.5 };
    collapseCheckRequired = true;
  } else {
    band = EXERTION_BANDS.COLLAPSE_RISK;
    label = "At Risk of Collapse";
    penalties = { attack: -6, block: -5, evade: -6, ps: -4, speed: 0.3, collapseCheck: true };
    collapseCheckRequired = true;
    forcedCollapse = current <= floor;
  }

  const collapseTarget = collapseCheckRequired
    ? Math.min(20, Math.max(6, Math.ceil(6 + debtRatio * 14)))
    : null;

  return Object.freeze({
    currentStamina: current,
    maxStamina: max,
    debtFloor: floor,
    positiveRatio,
    debt,
    debtRatio,
    band,
    label,
    penalties: Object.freeze({ ...penalties }),
    collapseCheckRequired,
    collapseTarget,
    forcedCollapse,
    operatingOnDebt: current < 0,
    bodyStopSignal: current <= 0,
  });
}

const fighterId = (fighter = {}) => fighter?.id ?? fighter?._id ?? null;

const isTerminal = (fighter = {}) => {
  const hp = firstFinite(fighter.currentHP, fighter.hp, fighter.HP, fighter.hitPoints);
  const status = String(fighter.status || "").toLowerCase();
  return fighter.isDead === true || fighter.dead === true || fighter.isUnconscious === true ||
    fighter.unconscious === true || (hp !== null && hp <= 0) ||
    ["dead", "dying", "unconscious", "defeated"].includes(status);
};

export function resolveSurvivalOverride({
  fighter = {},
  opponent = null,
  distanceFeet = Infinity,
  immediateThreat = false,
  activeGrapple = false,
  routed = false,
  panicked = false,
  manualChoice = false,
  actionType = "action",
} = {}) {
  const max = firstFinite(
    fighter.combatStamina?.maxStamina,
    fighter.maxStamina,
    fighter.fatigueState?.maxStamina,
  ) ?? 1;
  const current = firstFinite(
    fighter.combatStamina?.currentStamina,
    fighter.currentStamina,
    fighter.fatigueState?.currentStamina,
  ) ?? max;
  const profile = getExertionProfile(current, max);

  if (profile.currentStamina > 0) {
    return Object.freeze({ active: false, reason: "stamina-positive", actionType, profile });
  }

  const opponentCapable = Boolean(opponent && !isTerminal(opponent));
  const reciprocalGrapple = Boolean(
    opponentCapable && (
      activeGrapple ||
      fighter?.grappleState?.opponent === fighterId(opponent) ||
      fighter?.grappleState?.opponentId === fighterId(opponent)
    )
  );
  const closeThreat = opponentCapable && finite(distanceFeet, Infinity) <= 15;
  const morale = String(fighter?.moraleState?.status || fighter?.state?.moraleState || "").toLowerCase();
  const survivalMorale = routed || panicked || ["routed", "broken", "panicked"].includes(morale);
  const hp = firstFinite(fighter.currentHP, fighter.hp, fighter.HP, fighter.hitPoints);
  const maxHp = firstFinite(fighter.maxHP, fighter.maxHp, fighter.maxHitPoints, fighter.hitPointsMax);
  const badlyWounded = hp !== null && maxHp !== null && maxHp > 0 && hp / maxHp <= 0.25;

  let reason = null;
  if (manualChoice) reason = "player-declared-desperation";
  else if (reciprocalGrapple) reason = "active-grapple-threat";
  else if (immediateThreat || closeThreat) reason = "immediate-lethal-threat";
  else if (survivalMorale) reason = "panic-survival-flight";
  else if (badlyWounded && opponentCapable) reason = "badly-wounded-survival-response";

  return Object.freeze({
    active: Boolean(reason),
    reason: reason || "body-demands-recovery",
    actionType,
    opponentId: fighterId(opponent),
    distanceFeet: Number.isFinite(Number(distanceFeet)) ? Number(distanceFeet) : null,
    profile,
  });
}

export function resolveExertionActionPolicy({
  currentStamina = 0,
  maxStamina = 1,
  cost = 0,
  survivalOverride = null,
  manualChoice = false,
  alreadyOverexerted = false,
} = {}) {
  const profile = getExertionProfile(currentStamina, maxStamina);
  const requestedCost = Math.max(0, finite(cost, 0));
  const projectedStamina = profile.currentStamina - requestedCost;

  if (requestedCost <= 0) {
    return Object.freeze({
      canAttempt: true,
      allowOverexertion: false,
      reason: "no-stamina-cost",
      currentStamina: profile.currentStamina,
      maxStamina: profile.maxStamina,
      projectedStamina: profile.currentStamina,
      profile,
    });
  }

  if (projectedStamina < profile.debtFloor) {
    return Object.freeze({
      canAttempt: false,
      allowOverexertion: false,
      reason: "exertion-floor-would-be-exceeded",
      currentStamina: profile.currentStamina,
      maxStamina: profile.maxStamina,
      projectedStamina,
      debtFloor: profile.debtFloor,
      profile,
    });
  }

  if (projectedStamina >= 0) {
    return Object.freeze({
      canAttempt: true,
      allowOverexertion: false,
      reason: "stamina-sufficient",
      currentStamina: profile.currentStamina,
      maxStamina: profile.maxStamina,
      projectedStamina,
      profile,
    });
  }

  if (alreadyOverexerted) {
    return Object.freeze({
      canAttempt: false,
      allowOverexertion: false,
      reason: "overexertion-limit-reached",
      currentStamina: profile.currentStamina,
      maxStamina: profile.maxStamina,
      projectedStamina,
      debtFloor: profile.debtFloor,
      profile,
    });
  }

  const overrideActive = Boolean(survivalOverride?.active || manualChoice);
  const crossingZero = profile.currentStamina > 0 && projectedStamina < 0;
  if (profile.currentStamina <= 0 && !overrideActive) {
    return Object.freeze({
      canAttempt: false,
      allowOverexertion: false,
      reason: "body-demands-recovery",
      currentStamina: profile.currentStamina,
      maxStamina: profile.maxStamina,
      projectedStamina,
      debtFloor: profile.debtFloor,
      survivalOverride,
      profile,
    });
  }

  const projectedProfile = getExertionProfile(projectedStamina, profile.maxStamina);
  return Object.freeze({
    canAttempt: true,
    allowOverexertion: true,
    reason: crossingZero
      ? "crossing-into-exertion-debt"
      : survivalOverride?.reason || (manualChoice ? "player-declared-desperation" : "survival-override"),
    currentStamina: profile.currentStamina,
    maxStamina: profile.maxStamina,
    projectedStamina,
    debtFloor: profile.debtFloor,
    alreadyOverexerted: Boolean(alreadyOverexerted),
    crossingZero,
    survivalOverride,
    profile,
    projectedProfile,
    collapseCheckRequired: projectedProfile.collapseCheckRequired,
  });
}

export function applyExertionProfileToFighter(fighter = {}, currentStamina, maxStamina) {
  const profile = getExertionProfile(currentStamina, maxStamina);
  const priorFatigue = fighter.fatigueState || {};
  const collapsed = priorFatigue.status === "collapsed" || fighter.collapsed === true;
  const fatigueStatus = collapsed
    ? "collapsed"
    : profile.collapseCheckRequired
      ? "collapse_risk"
      : profile.band === EXERTION_BANDS.FRESH || profile.band === EXERTION_BANDS.WINDED
        ? "ready"
        : profile.band === EXERTION_BANDS.EXHAUSTED || profile.band === EXERTION_BANDS.OVEREXERTED
          ? "fatigued"
          : "exhausted";
  const fatigueLevel = collapsed ? 5 :
    profile.band === EXERTION_BANDS.FRESH || profile.band === EXERTION_BANDS.WINDED ? 0 :
      profile.band === EXERTION_BANDS.EXHAUSTED || profile.band === EXERTION_BANDS.OVEREXERTED ? 1 :
        profile.band === EXERTION_BANDS.SEVERE ? 2 :
          profile.band === EXERTION_BANDS.CRITICAL ? 3 : 4;
  const statusEffects = Array.isArray(fighter.statusEffects) ? [...fighter.statusEffects] : [];
  const priorExertionAppliedExhausted = fighter.exertionState?.exhaustedStatusApplied === true;
  if (profile.bodyStopSignal && !statusEffects.includes("EXHAUSTED")) statusEffects.push("EXHAUSTED");
  if (!profile.bodyStopSignal && priorExertionAppliedExhausted) {
    const index = statusEffects.indexOf("EXHAUSTED");
    if (index >= 0) statusEffects.splice(index, 1);
  }

  return {
    ...fighter,
    maxStamina: profile.maxStamina,
    currentStamina: profile.currentStamina,
    currentstamina: profile.currentStamina,
    staminaCurrent: profile.currentStamina,
    staminaAuthority: "combat-stamina",
    fatigueLabel: profile.label,
    statusEffects,
    ...(fighter.derived && typeof fighter.derived === "object"
      ? { derived: { ...fighter.derived, currentstamina: profile.currentStamina, maxstamina: profile.maxStamina } }
      : {}),
    ...(!Array.isArray(fighter.training) && fighter.training && typeof fighter.training === "object"
      ? { training: { ...fighter.training, currentstamina: profile.currentStamina, maxstamina: profile.maxStamina } }
      : {}),
    combatStamina: {
      ...(fighter.combatStamina || {}),
      maxStamina: profile.maxStamina,
      current: profile.currentStamina,
      currentStamina: profile.currentStamina,
      authority: "combat-stamina",
      debtFloor: profile.debtFloor,
      debt: profile.debt,
      debtRatio: profile.debtRatio,
      exertionBand: profile.band,
    },
    fatigueState: {
      ...priorFatigue,
      maxStamina: profile.maxStamina,
      currentStamina: profile.currentStamina,
      authority: "combat-stamina",
      status: fatigueStatus,
      fatigueLevel,
      penalties: { ...profile.penalties },
    },
    exertionState: {
      ...(fighter.exertionState || {}),
      ...profile,
      penalties: { ...profile.penalties },
      exhaustedStatusApplied: profile.bodyStopSignal,
    },
  };
}

export default {
  EXERTION_BANDS,
  applyExertionProfileToFighter,
  getExertionProfile,
  getStaminaDebtFloor,
  resolveExertionActionPolicy,
  resolveSurvivalOverride,
};
