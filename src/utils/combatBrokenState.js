const normalize = (value) => String(value || "").trim().toLowerCase();

export const EXHAUSTED_COWER_TERMINAL_THRESHOLD = 3;

export function isCombatantBroken(combatant = {}) {
  if (!combatant) return false;
  const statuses = [
    combatant.status,
    combatant.combatState,
    combatant.moraleState?.status,
    combatant.state?.moraleState,
  ].map(normalize);
  return combatant.isSurrendered === true ||
    combatant.isCombatBroken === true ||
    statuses.some((status) => ["surrendered", "combat-broken", "combatbroken"].includes(status)) ||
    (Array.isArray(combatant.statusEffects) && combatant.statusEffects.some(
      (effect) => ["surrendered", "combat-broken", "combatbroken"].includes(normalize(effect))
    ));
}

export function markCombatantSurrendered(combatant = {}, reason = "exhausted-cower") {
  const statusEffects = Array.isArray(combatant.statusEffects)
    ? combatant.statusEffects.filter((effect) => normalize(effect) !== "routed")
    : [];
  return {
    ...combatant,
    status: "surrendered",
    combatState: "surrendered",
    isSurrendered: true,
    isCombatBroken: true,
    active: false,
    isActive: false,
    canAct: false,
    remainingActions: 0,
    defeatReason: "surrendered",
    routingExhaustedCowerCount: EXHAUSTED_COWER_TERMINAL_THRESHOLD,
    moraleState: {
      ...(combatant.moraleState || {}),
      status: "SURRENDERED",
      hasFled: false,
      exhaustedCowerCount: EXHAUSTED_COWER_TERMINAL_THRESHOLD,
      terminalReason: reason,
    },
    statusEffects: Array.from(new Set([...statusEffects, "SURRENDERED"])),
  };
}

export function advanceExhaustedCower(combatant = {}, {
  threshold = EXHAUSTED_COWER_TERMINAL_THRESHOLD,
} = {}) {
  const previousCount = Math.max(0, Number(
    combatant.routingExhaustedCowerCount ?? combatant.moraleState?.exhaustedCowerCount ?? 0
  ) || 0);
  const count = previousCount + 1;
  if (count >= threshold) {
    return { actor: markCombatantSurrendered(combatant), count, terminal: true };
  }
  return {
    actor: {
      ...combatant,
      routingExhaustedCowerCount: count,
      moraleState: {
        ...(combatant.moraleState || {}),
        status: "ROUTED",
        hasFled: false,
        exhaustedCowerCount: count,
      },
    },
    count,
    terminal: false,
  };
}

export function resetExhaustedCowerCount(combatant = {}) {
  if (!combatant) return combatant;
  return {
    ...combatant,
    routingExhaustedCowerCount: 0,
    moraleState: {
      ...(combatant.moraleState || {}),
      exhaustedCowerCount: 0,
    },
  };
}

export function resolveCombatSideOutcome({
  partyCount = 0,
  hostileCount = 0,
  activePartyCount = 0,
  activeHostileCount = 0,
} = {}) {
  const hasBothSides = partyCount > 0 && hostileCount > 0;
  return {
    bothSidesBroken: hasBothSides && activePartyCount === 0 && activeHostileCount === 0,
    partyDefeated: partyCount > 0 && activePartyCount === 0 && activeHostileCount > 0,
    partyVictorious: hostileCount > 0 && activePartyCount > 0 && activeHostileCount === 0,
  };
}

export default {
  EXHAUSTED_COWER_TERMINAL_THRESHOLD,
  advanceExhaustedCower,
  isCombatantBroken,
  markCombatantSurrendered,
  resetExhaustedCowerCount,
  resolveCombatSideOutcome,
};
