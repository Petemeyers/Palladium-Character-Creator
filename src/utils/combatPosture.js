import { applyStaminaRecovery } from "./combatRecovery.js";
import { calculateRecoveryStamina } from "./combatStamina.js";

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

const RESERVE_TYPE_BY_POSTURE = {
  block: "block",
  blocking: "block",
  evade: "evade",
  evading: "evade",
  defend: "defend",
  defending: "defend",
};

const POSTURE_TYPE_BY_RESERVE = {
  block: "blocking",
  evade: "evading",
  defend: "defending",
};

const PENDING_DEFENSE_BY_ACTION = {
  block: { reserveType: "block", postureType: "blocking", stance: "Block" },
  evade: { reserveType: "evade", postureType: "evading", stance: "Evade" },
  defend: { reserveType: "defend", postureType: "defending", stance: "Defend" },
  "defend/hold": { reserveType: "defend", postureType: "defending", stance: "Defend" },
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

export function normalizeDefensiveReserveType(value = "") {
  return RESERVE_TYPE_BY_POSTURE[String(value || "").trim().toLowerCase()] || "";
}

export function getPendingDefensiveSelection(selectedCombatAction = null, selectedLegacyAction = null) {
  const commandName = String(selectedCombatAction?.type || selectedCombatAction?.id || selectedCombatAction?.name || "")
    .trim()
    .toLowerCase();
  const legacyName = String(selectedLegacyAction?.name || selectedLegacyAction?.type || selectedLegacyAction || "")
    .trim()
    .toLowerCase();
  const selectedName = selectedCombatAction
    ? (PENDING_DEFENSE_BY_ACTION[commandName] ? commandName : "")
    : legacyName;
  const definition = PENDING_DEFENSE_BY_ACTION[selectedName];
  if (!definition) return null;
  return {
    ...definition,
    actionName: selectedName === "defend/hold" ? "Defend/Hold" : definition.stance,
    actionCost: Math.max(1, Number(selectedCombatAction?.costActions) || 1),
  };
}

export function applyPendingDefensiveSelection(
  combatantOrTurnEntry = {},
  { selectedCombatAction = null, selectedLegacyAction = null, round = 1, turnIndex = 0, actionCost = null } = {}
) {
  const selection = getPendingDefensiveSelection(selectedCombatAction, selectedLegacyAction);
  if (!selection) return { ok: true, applied: false, updated: combatantOrTurnEntry, selection: null };

  const existingReserve = getDefensiveReserve(combatantOrTurnEntry);
  if (existingReserve.active && existingReserve.type === selection.reserveType) {
    return { ok: true, applied: false, updated: combatantOrTurnEntry, selection };
  }

  if (selectedCombatAction?.enabled === false) {
    return { ok: false, applied: false, updated: combatantOrTurnEntry, selection };
  }

  const remainingActions = Math.max(0, Number(combatantOrTurnEntry?.remainingActions) || 0);
  const cost = Math.max(1, Number(actionCost ?? selection.actionCost) || 1);
  if (remainingActions < cost) {
    return { ok: false, applied: false, updated: combatantOrTurnEntry, selection };
  }

  const posture = createCombatPosture({
    type: selection.postureType,
    round,
    turnIndex,
  });
  const updated = applyDefensiveReserve({
    ...applyCombatPosture(combatantOrTurnEntry, posture),
    remainingActions: Math.max(0, remainingActions - cost),
  }, selection.reserveType, 1);

  return { ok: true, applied: true, updated, posture, selection };
}

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
    reserveActions: Math.max(0, toSafeIndex(posture.reserveActions, 0)),
    defensiveReserveType: normalizeDefensiveReserveType(posture.defensiveReserveType || posture.type),
  };
}

export function getDefensiveReserve(combatantOrTurnEntry = {}) {
  const posture = getCombatPosture(combatantOrTurnEntry);
  const topLevelType = normalizeDefensiveReserveType(combatantOrTurnEntry?.defensiveReserveType);
  const postureType = normalizeDefensiveReserveType(posture?.defensiveReserveType || posture?.type);
  const type = topLevelType || postureType;
  const actions = Math.max(
    0,
    toSafeIndex(
      combatantOrTurnEntry?.defensiveReserveActions ?? posture?.reserveActions,
      0
    )
  );

  return {
    active: Boolean(type && actions > 0 && combatantOrTurnEntry?.defensiveReserve !== false),
    type,
    actions,
  };
}

export function canUseDefensiveReserveForReaction(combatantOrTurnEntry = {}, defenseType = "") {
  const reserve = getDefensiveReserve(combatantOrTurnEntry);
  const requestedType = normalizeDefensiveReserveType(defenseType);
  return Boolean(reserve.active && requestedType && reserve.type === requestedType);
}

export function clearDefensiveReserve(combatantOrTurnEntry = {}) {
  const {
    defensiveReserve: _defensiveReserve,
    defensiveReserveType: _defensiveReserveType,
    defensiveReserveActions: _defensiveReserveActions,
    ...rest
  } = combatantOrTurnEntry || {};
  const posture = getCombatPosture(rest);
  if (!posture) return rest;
  return {
    ...rest,
    combatPosture: {
      ...posture,
      reserveActions: 0,
      defensiveReserveType: "",
    },
  };
}

export function applyDefensiveReserve(combatantOrTurnEntry = {}, reserveType = "defend", actions = 1) {
  const normalizedType = normalizeDefensiveReserveType(reserveType) || "defend";
  const postureType = POSTURE_TYPE_BY_RESERVE[normalizedType] || "defending";
  const reserveActions = Math.max(0, toSafeIndex(actions, 1));
  const posture = getCombatPosture(combatantOrTurnEntry) ||
    createCombatPosture({ type: postureType });

  return {
    ...combatantOrTurnEntry,
    defensiveReserve: reserveActions > 0,
    defensiveReserveType: normalizedType,
    defensiveReserveActions: reserveActions,
    defensiveRecoveryInterrupted: false,
    combatPosture: {
      ...posture,
      type: postureType,
      label: POSTURE_DEFINITIONS[postureType]?.label || posture.label,
      expires: posture.expires || "next-turn",
      note: posture.note || POSTURE_DEFINITIONS[postureType]?.note || "",
      reserveActions,
      defensiveReserveType: normalizedType,
    },
  };
}

export function interruptDefensiveRecovery(combatantOrTurnEntry = {}) {
  const posture = getCombatPosture(combatantOrTurnEntry);
  if (!posture) return { ...combatantOrTurnEntry };
  return {
    ...combatantOrTurnEntry,
    defensiveRecoveryInterrupted: true,
    combatPosture: {
      ...posture,
      defensiveRecoveryInterrupted: true,
    },
  };
}

export function consumeDefensiveReserve(combatantOrTurnEntry = {}) {
  const reserve = getDefensiveReserve(combatantOrTurnEntry);
  if (!reserve.active) return { ...combatantOrTurnEntry };

  const remainingReserveActions = Math.max(0, reserve.actions - 1);
  if (remainingReserveActions <= 0) {
    return clearDefensiveReserve(combatantOrTurnEntry);
  }

  return {
    ...combatantOrTurnEntry,
    defensiveReserve: true,
    defensiveReserveType: reserve.type,
    defensiveReserveActions: remainingReserveActions,
    combatPosture: {
      ...(getCombatPosture(combatantOrTurnEntry) || {}),
      reserveActions: remainingReserveActions,
      defensiveReserveType: reserve.type,
    },
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
    const interrupted = combatantOrTurnEntry?.defensiveRecoveryInterrupted === true ||
      combatantOrTurnEntry?.combatPosture?.defensiveRecoveryInterrupted === true;
    const {
      combatPosture: _combatPosture,
      defensiveReserve: _defensiveReserve,
      defensiveReserveType: _defensiveReserveType,
      defensiveReserveActions: _defensiveReserveActions,
      defensiveRecoveryInterrupted: _defensiveRecoveryInterrupted,
      ...rest
    } = combatantOrTurnEntry || {};
    const recoveryAmount = calculateRecoveryStamina({ fighter: rest, recoveryType: "defensive-posture" });
    const recovery = interrupted
      ? { ok: false, updated: rest, recovered: 0 }
      : applyStaminaRecovery(rest, recoveryAmount);
    return {
      ...(recovery.ok ? recovery.updated : rest),
      lastDefensiveRecovery: {
        resolvedRound: toSafeRound(currentRound),
        interrupted,
        recovered: recovery.recovered || 0,
      },
    };
  }

  return { ...combatantOrTurnEntry, combatPosture: posture };
}

export default {
  applyPendingDefensiveSelection,
  applyDefensiveReserve,
  applyCombatPosture,
  applyDefensivePosture,
  canUseDefensiveReserveForReaction,
  clearExpiredPostures,
  clearDefensiveReserve,
  consumeDefensiveReserve,
  createCombatPosture,
  createDefensivePosture,
  getDefensiveReserve,
  getCombatPosture,
  getPendingDefensiveSelection,
  interruptDefensiveRecovery,
  normalizeDefensiveReserveType,
};
