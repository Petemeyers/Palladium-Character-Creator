const DEFENSIVE_POSTURE = {
  type: "defending",
  label: "Defending",
  expires: "next-turn",
  note: "Defensive posture active until this combatant's next turn.",
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
  return {
    ...DEFENSIVE_POSTURE,
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
  return {
    ...combatantOrTurnEntry,
    combatPosture: getCombatPosture({ combatPosture: posture }) || createDefensivePosture(),
  };
}

export function clearExpiredPostures(combatantOrTurnEntry = {}, currentRound = 1, currentTurnIndex = 0) {
  const posture = getCombatPosture(combatantOrTurnEntry);
  if (!posture) return { ...combatantOrTurnEntry };

  const sameTurnSlot = posture.createdTurnIndex === toSafeIndex(currentTurnIndex);
  const laterRound = toSafeRound(currentRound) > posture.createdRound;
  if (posture.type === "defending" && posture.expires === "next-turn" && sameTurnSlot && laterRound) {
    const { combatPosture: _combatPosture, ...rest } = combatantOrTurnEntry || {};
    return rest;
  }

  return { ...combatantOrTurnEntry, combatPosture: posture };
}

export default {
  applyDefensivePosture,
  clearExpiredPostures,
  createDefensivePosture,
  getCombatPosture,
};
