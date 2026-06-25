const POSTURE_DEFINITIONS = {
  defending: {
    type: "defending",
    label: "Defending",
    expires: "next-turn",
    note: "Defensive posture active until this combatant's next turn.",
  },
  blocking: {
    type: "blocking",
    label: "Blocking",
    expires: "next-turn",
    note: "Blocking posture active until this combatant's next turn.",
  },
  evading: {
    type: "evading",
    label: "Evading",
    expires: "next-turn",
    note: "Evading posture active until this combatant's next turn.",
  },
};

const toSafeIndex = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
};

const toSafeRound = (value, fallback = 1) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 ? number : fallback;
};

const isPlainPosture = (value) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  typeof value.type === "string";

export function createDefensivePosture({ round = 1, turnIndex = 0 } = {}) {
  return createCombatPosture({ type: "defending", round, turnIndex });
}

export function createCombatPosture({ type = "defending", round = 1, turnIndex = 0 } = {}) {
  const definition = POSTURE_DEFINITIONS[type] || POSTURE_DEFINITIONS.defending;
  return {
    ...definition,
    createdRound: toSafeRound(round),
    createdTurnIndex: toSafeIndex(turnIndex),
  };
}

export function getCombatPosture(combatantOrTurnEntry = {}) {
  const posture = combatantOrTurnEntry?.combatPosture;
  if (!isPlainPosture(posture)) return null;

  return {
    type: String(posture.type || ""),
    label: String(posture.label || posture.type || ""),
    createdRound: toSafeRound(posture.createdRound),
    createdTurnIndex: toSafeIndex(posture.createdTurnIndex),
    expires: String(posture.expires || ""),
    note: String(posture.note || ""),
  };
}

export function applyDefensivePosture(combatantOrTurnEntry = {}, posture = createDefensivePosture()) {
  return applyCombatPosture(combatantOrTurnEntry, posture);
}

export function applyCombatPosture(combatantOrTurnEntry = {}, posture = createCombatPosture()) {
  return {
    ...combatantOrTurnEntry,
    combatPosture: getCombatPosture({ combatPosture: posture }) || createCombatPosture(),
  };
}

export function clearExpiredPostures(combatantOrTurnEntry = {}, currentRound = 1, currentTurnIndex = 0) {
  const posture = getCombatPosture(combatantOrTurnEntry);
  if (!posture) return { ...combatantOrTurnEntry };

  const sameTurnSlot = posture.createdTurnIndex === toSafeIndex(currentTurnIndex);
  const laterRound = toSafeRound(currentRound) > posture.createdRound;
  const supportedPosture = Boolean(POSTURE_DEFINITIONS[posture.type]);
  if (supportedPosture && posture.expires === "next-turn" && sameTurnSlot && laterRound) {
    const { combatPosture: _combatPosture, ...rest } = combatantOrTurnEntry || {};
    return rest;
  }

  return { ...combatantOrTurnEntry, combatPosture: posture };
}

export default {
  applyCombatPosture,
  applyDefensivePosture,
  clearExpiredPostures,
  createCombatPosture,
  createDefensivePosture,
  getCombatPosture,
};
