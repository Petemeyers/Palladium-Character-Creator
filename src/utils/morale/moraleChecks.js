import {
  MORALE_STATES,
  MORALE_STATE_ORDER,
  ROUT_BEHAVIORS,
  ROUT_REASONS,
} from "./moraleConstants.js";
import {
  getActorAttributes,
  getAttributeMod,
  getHiddenMoraleMod,
  getMoraleProfile,
  hasTrait,
} from "./moraleAttributes.js";

const normalizeText = (value) => String(value || "").trim().toLowerCase();
const finiteOr = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const isLegacyFled = (actor = {}) => (
  actor.fled === true ||
  actor.moraleState?.hasFled === true ||
  normalizeText(actor.status) === MORALE_STATES.FLED ||
  normalizeText(actor.moraleState?.status) === MORALE_STATES.FLED ||
  (Array.isArray(actor.statusEffects) && actor.statusEffects.some(
    (effect) => normalizeText(effect) === MORALE_STATES.FLED,
  ))
);

const cloneState = (actor = {}) => ({
  moraleState: MORALE_STATES.STEADY,
  routReason: null,
  routTurns: 0,
  minimumRoutTurns: 0,
  hasFledBattle: false,
  ...(actor.state || {}),
});

const improveMoraleState = (state) => {
  if (state === MORALE_STATES.FLED) return MORALE_STATES.FLED;
  const index = Math.max(0, MORALE_STATE_ORDER.indexOf(state));
  return MORALE_STATE_ORDER[Math.max(0, index - 1)];
};

const worsenMoraleState = (state) => {
  if (state === MORALE_STATES.FLED) return MORALE_STATES.FLED;
  const index = Math.max(0, MORALE_STATE_ORDER.indexOf(state));
  return MORALE_STATE_ORDER[Math.min(MORALE_STATE_ORDER.indexOf(MORALE_STATES.BROKEN), index + 1)];
};

const rollD20 = (rng) => {
  const value = Math.min(0.999999999, Math.max(0, finiteOr(rng?.(), 0)));
  return Math.floor(value * 20) + 1;
};

const getCommanderPresenceBonus = (context = {}) => {
  if (!context.commanderNearby) return 0;
  const explicit = Number(context.commanderPresenceBonus);
  if (Number.isFinite(explicit)) return explicit;
  return getAttributeMod(getActorAttributes(context.commander || {}).presence);
};

const getMinimumRoutTurns = (reason) => {
  if (reason === ROUT_REASONS.MYTHIC_TERROR) return 4;
  if ([ROUT_REASONS.LEADER_DEATH, ROUT_REASONS.FORMATION_COLLAPSE].includes(reason)) return 3;
  if ([ROUT_REASONS.PAIN, ROUT_REASONS.WOUND_SHOCK, ROUT_REASONS.FEAR].includes(reason)) return 2;
  return 1;
};

export function normalizeMoraleState(actor = {}) {
  const state = cloneState(actor);
  const explicitState = normalizeText(actor.state?.moraleState);
  const legacyState = normalizeText(actor.moraleState?.status);
  const hasLegacyRoutedEffect = Array.isArray(actor.statusEffects) && actor.statusEffects.some(
    (effect) => normalizeText(effect) === MORALE_STATES.ROUTED,
  );
  const knownState = MORALE_STATE_ORDER.includes(explicitState)
    ? explicitState
    : MORALE_STATE_ORDER.includes(legacyState)
      ? legacyState
      : hasLegacyRoutedEffect
        ? MORALE_STATES.ROUTED
        : MORALE_STATES.STEADY;
  const hasFledBattle = state.hasFledBattle === true || knownState === MORALE_STATES.FLED || isLegacyFled(actor);
  const normalizedState = {
    ...state,
    moraleState: hasFledBattle ? MORALE_STATES.FLED : knownState,
    hasFledBattle,
    routTurns: Math.max(0, finiteOr(state.routTurns, 0)),
    minimumRoutTurns: Math.max(0, finiteOr(state.minimumRoutTurns, 0)),
  };

  return {
    ...actor,
    ...(hasFledBattle ? { inBattle: false, canAct: false, remainingActions: 0 } : {}),
    state: normalizedState,
  };
}

export function getMoraleDefense(actor = {}, context = {}) {
  const attributes = getActorAttributes(actor);
  const profile = getMoraleProfile(actor);
  const reason = context.routReason || ROUT_REASONS.FEAR;
  let total = getAttributeMod(attributes.resolve) + getAttributeMod(attributes.discipline);

  if ([ROUT_REASONS.PAIN, ROUT_REASONS.WOUND_SHOCK].includes(reason)) {
    total += getAttributeMod(attributes.vigor) + getAttributeMod(attributes.endurance);
    total -= getHiddenMoraleMod(profile.woundPanic);
  } else if (reason === ROUT_REASONS.FATIGUE) {
    total += getAttributeMod(attributes.endurance);
  } else if (reason === ROUT_REASONS.ISOLATION) {
    total += getAttributeMod(attributes.awareness) + getHiddenMoraleMod(profile.loyaltyBond);
  } else if (reason === ROUT_REASONS.CONFUSION) {
    total += getAttributeMod(attributes.awareness) + getAttributeMod(attributes.intellect);
  } else if (reason === ROUT_REASONS.MYTHIC_TERROR) {
    total += getAttributeMod(attributes.favor);
    total += getHiddenMoraleMod(profile.courageTendency) + getHiddenMoraleMod(profile.oathPressure);
  } else if (reason === ROUT_REASONS.FORMATION_COLLAPSE) {
    total += getAttributeMod(attributes.awareness) + finiteOr(context.formationDrillBonus);
  } else if (reason === ROUT_REASONS.LEADER_DEATH) {
    total += getHiddenMoraleMod(profile.loyaltyBond) + getHiddenMoraleMod(profile.commandTrust);
  } else if (reason === ROUT_REASONS.OUTNUMBERED) {
    total += getAttributeMod(attributes.awareness) + getHiddenMoraleMod(profile.courageTendency);
  } else {
    total += getHiddenMoraleMod(profile.courageTendency);
  }

  total += getCommanderPresenceBonus(context);
  if (context.commanderNearby) total += getHiddenMoraleMod(profile.commandTrust);
  if (finiteOr(context.alliesNearby) > 0) {
    total += Math.min(2, finiteOr(context.alliesNearby));
    total += getHiddenMoraleMod(profile.loyaltyBond);
  }
  if (context.outnumbered) total -= 2;
  if (context.badlyWounded) total -= 2;
  if (context.surrounded) total -= 4;
  if (context.leaderDead) total -= 4;
  if (context.formationCollapsed) total -= 3;
  if (context.mythicTerror) {
    const sourcePresence = getAttributeMod(getActorAttributes(context.terrorSource || {}).presence);
    total -= finiteOr(context.terrorPenalty, Math.max(1, sourcePresence));
  }
  if (context.fearType && profile.fearMemory?.[context.fearType]) {
    total -= finiteOr(profile.fearMemory[context.fearType]);
  }

  total -= getHiddenMoraleMod(profile.traumaLoad);
  total -= getHiddenMoraleMod(profile.routSusceptibility);
  if (hasTrait(actor, "oath_fast")) total += 3;
  if (hasTrait(actor, "rout_survivor")) total += 2;
  if (hasTrait(actor, "line_holder")) total += 2;
  if (hasTrait(actor, "monster_dread_tested")) total += 2;
  return total;
}

export function getRecoveryBonus(actor = {}, context = {}) {
  const attributes = getActorAttributes(actor);
  const profile = getMoraleProfile(actor);
  const reason = actor?.state?.routReason;
  let total = getAttributeMod(attributes.resolve) + getAttributeMod(attributes.discipline);

  if ([ROUT_REASONS.PAIN, ROUT_REASONS.WOUND_SHOCK].includes(reason)) {
    total += getAttributeMod(attributes.vigor) + getAttributeMod(attributes.endurance);
    total -= getHiddenMoraleMod(profile.woundPanic);
  } else if (reason === ROUT_REASONS.FATIGUE) {
    total += getAttributeMod(attributes.endurance);
  } else if (reason === ROUT_REASONS.ISOLATION) {
    total += getAttributeMod(attributes.awareness) + getHiddenMoraleMod(profile.loyaltyBond);
  } else if (reason === ROUT_REASONS.LEADER_DEATH) {
    total += getHiddenMoraleMod(profile.loyaltyBond) + getHiddenMoraleMod(profile.commandTrust);
  } else if (reason === ROUT_REASONS.MYTHIC_TERROR) {
    total += getAttributeMod(attributes.favor) + getHiddenMoraleMod(profile.courageTendency);
  } else {
    total += getHiddenMoraleMod(profile.courageTendency);
  }

  total += getCommanderPresenceBonus(context);
  if (context.commanderNearby) total += getHiddenMoraleMod(profile.commandTrust);
  if (finiteOr(context.alliesNearby) > 0) {
    total += Math.min(2, finiteOr(context.alliesNearby));
    total += getHiddenMoraleMod(profile.loyaltyBond);
  }
  if (context.inCover) total += 1;
  if (context.behindFriendlyLine) total += 2;
  if (context.enemyAdjacent) total -= 4;
  if (context.surrounded) total -= 4;
  if (context.badlyWounded) total -= 2;
  if (context.mythicTerrorNearby) total -= 3;
  total += finiteOr(context.staminaRallyBonus);
  total += finiteOr(context.armorConfidenceBonus);
  if (hasTrait(actor, "rout_survivor")) total += 2;
  if (hasTrait(actor, "oath_fast")) total += 3;
  if (hasTrait(actor, "labyrinth_born") && context.nearWalls) total += 2;
  return total;
}

export function performMoraleCheck(actor = {}, context = {}, rng = Math.random) {
  const normalized = normalizeMoraleState(actor);
  if (normalized.state.hasFledBattle) return { actor: normalized, result: "already_fled", skipped: true };
  if (context.routingEnabled === false || normalized.routingEnabled === false) {
    return { actor: normalized, result: "routing_disabled", skipped: true };
  }

  const roll = rollD20(rng);
  const dc = finiteOr(context.dc, 13);
  const defense = getMoraleDefense(normalized, context);
  const total = roll + defense;
  const margin = total - dc;
  let moraleState = normalized.state.moraleState;
  let result = "success";
  let statePatch = {};

  if (roll === 20 || margin >= 5) {
    moraleState = improveMoraleState(moraleState);
    result = "strong_success";
  } else if (margin < 0) {
    const reason = context.routReason || ROUT_REASONS.FEAR;
    if (roll === 1 || (margin <= -10 && [MORALE_STATES.ROUTED, MORALE_STATES.BROKEN].includes(moraleState))) {
      moraleState = MORALE_STATES.BROKEN;
      result = "broken";
      statePatch = { routReason: reason, minimumRoutTurns: Math.max(3, getMinimumRoutTurns(reason)) };
    } else if (margin <= -5) {
      moraleState = MORALE_STATES.ROUTED;
      result = "routed";
      statePatch = { routReason: reason, routTurns: 0, minimumRoutTurns: getMinimumRoutTurns(reason) };
    } else {
      moraleState = worsenMoraleState(moraleState);
      result = "shaken";
    }
  }

  return {
    actor: {
      ...normalized,
      state: { ...normalized.state, ...statePatch, moraleState },
    },
    roll,
    total,
    dc,
    defense,
    result,
  };
}

export function attemptRoutRecovery(actor = {}, context = {}, rng = Math.random) {
  const normalized = normalizeMoraleState(actor);
  if (normalized.state.hasFledBattle) return { actor: normalized, result: "already_fled", skipped: true };
  if (
    context.allowRecoveryWhenRoutingDisabled !== true &&
    (context.routingEnabled === false || normalized.routingEnabled === false)
  ) {
    return { actor: normalized, result: "routing_disabled", skipped: true };
  }
  if (![MORALE_STATES.ROUTED, MORALE_STATES.BROKEN].includes(normalized.state.moraleState)) {
    return { actor: normalized, result: "not_routed", skipped: true };
  }

  const requiredTurns = Math.max(1, finiteOr(normalized.state.minimumRoutTurns, 1));
  const oathFast = hasTrait(normalized, "oath_fast");
  const earliestTurn = oathFast ? Math.max(0, requiredTurns - 1) : requiredTurns;
  if (finiteOr(normalized.state.routTurns) < earliestTurn) {
    return {
      actor: {
        ...normalized,
        state: { ...normalized.state, routTurns: finiteOr(normalized.state.routTurns) + 1 },
      },
      result: "no_attempt",
      skipped: true,
    };
  }

  const roll = rollD20(rng);
  const dc = finiteOr(context.recoveryDc, 15);
  const bonus = getRecoveryBonus(normalized, context);
  const total = roll + bonus;
  if (roll === 20 || total >= dc + 5) {
    return {
      actor: {
        ...normalized,
        state: {
          ...normalized.state,
          moraleState: MORALE_STATES.UNEASY,
          routReason: null,
          routTurns: 0,
          minimumRoutTurns: 0,
        },
      },
      roll, total, dc, bonus, result: "strong_recovery",
    };
  }
  if (total >= dc) {
    return {
      actor: {
        ...normalized,
        state: {
          ...normalized.state,
          moraleState: MORALE_STATES.SHAKEN,
          routReason: null,
          routTurns: 0,
          minimumRoutTurns: 0,
        },
      },
      roll, total, dc, bonus, result: "partial_recovery",
    };
  }
  return {
    actor: {
      ...normalized,
      state: { ...normalized.state, routTurns: finiteOr(normalized.state.routTurns) + 1 },
    },
    roll, total, dc, bonus, result: "still_routed",
  };
}

export function chooseRoutBehavior(actor = {}, context = {}) {
  const normalized = normalizeMoraleState(actor);
  const attributes = getActorAttributes(normalized);
  const profile = getMoraleProfile(normalized);
  if (normalized.state.hasFledBattle) return ROUT_BEHAVIORS.FLEE_TO_ESCAPE;
  if (context.escapeBlocked && (hasTrait(normalized, "cornered_fury") || finiteOr(profile.aggressionUnderFear, 2) >= 4)) {
    return ROUT_BEHAVIORS.CORNERED_FURY;
  }
  if (context.commanderNearby && finiteOr(profile.commandTrust, 2) >= 3) return ROUT_BEHAVIORS.SEEK_COMMANDER;
  if (finiteOr(context.alliesNearby) > 0 && finiteOr(profile.loyaltyBond, 2) >= 3) {
    return ROUT_BEHAVIORS.FALL_BACK_TO_ALLIES;
  }
  if (context.alliesCanSeeActor && finiteOr(profile.shamePressure, 2) >= 4 && finiteOr(profile.aggressionUnderFear, 2) >= 3) {
    return ROUT_BEHAVIORS.CORNERED_FURY;
  }
  if (normalized.state.moraleState === MORALE_STATES.BROKEN && context.canSurrender !== false && getAttributeMod(attributes.resolve) < 0) {
    return ROUT_BEHAVIORS.SURRENDER;
  }
  if (finiteOr(profile.survivalInstinct, 2) >= 4) return ROUT_BEHAVIORS.FLEE_TO_ESCAPE;
  if (getAttributeMod(attributes.cunning) >= 2 || getAttributeMod(attributes.awareness) >= 2) {
    return ROUT_BEHAVIORS.RETREAT_TO_COVER;
  }
  if (context.confused && getAttributeMod(attributes.awareness) < 0) return ROUT_BEHAVIORS.FREEZE;
  return ROUT_BEHAVIORS.PANIC_FLEE;
}

export function markActorFled(actor = {}, reason = "routExit") {
  const normalized = normalizeMoraleState(actor);
  const statusEffects = Array.isArray(normalized.statusEffects)
    ? normalized.statusEffects.filter((effect) => normalizeText(effect) !== MORALE_STATES.ROUTED)
    : [];
  return {
    ...normalized,
    inBattle: false,
    canAct: false,
    remainingActions: 0,
    fled: true,
    state: {
      ...normalized.state,
      moraleState: MORALE_STATES.FLED,
      hasFledBattle: true,
      fledReason: reason,
    },
    moraleState: {
      ...(normalized.moraleState || {}),
      status: "FLED",
      hasFled: true,
    },
    statusEffects: Array.from(new Set([...statusEffects, "FLED"])),
  };
}
