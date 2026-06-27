import {
  getExplicitCombatantControlMode,
  isEnemyCombatant,
  isManualPlayerCombatant,
} from "./combatantSide.js";

const cloneArray = (value) => (Array.isArray(value) ? [] : []);

const MOVEMENT_TYPES = new Set(["move", "run", "charge", "withdraw"]);
const NON_MOVEMENT_ACTIONS = new Set(["attack", "evade", "defend", "defend/hold", "block", "use item", "use-item", "use skill", "use-skill"]);
const LEGACY_DEFENSIVE_ACTIONS = new Set(["defend", "defend/hold", "evade", "block"]);
const EXPLICIT_MANUAL_END_TURN_SOURCES = new Set([
  "command-center-end-turn",
  "legacy-compatibility-end-turn",
]);
const LEGACY_DEFENSIVE_POSTURE_BY_ACTION = {
  defend: "Defend",
  "defend/hold": "Defend",
  block: "Block",
  evade: "Evade",
};

const getId = (value) => {
  if (!value || typeof value !== "object") return value ? String(value) : "";
  return String(value.id || value._id || value.fighterId || value.name || "");
};

const normalizeText = (value) => String(value || "").trim().toLowerCase();
const toDisplayName = (value) => {
  const text = String(value || "").trim();
  return text || "Combatant";
};

const getActionName = (action) => {
  if (!action || typeof action !== "object") return action;
  return action.name || action.label || action.type || "";
};

export function isLegacyDefensiveAction(actionName) {
  return LEGACY_DEFENSIVE_ACTIONS.has(normalizeText(getActionName(actionName)));
}

export function getLegacyDefensivePosture(actionName) {
  return LEGACY_DEFENSIVE_POSTURE_BY_ACTION[normalizeText(getActionName(actionName))] || "";
}

export function isDuplicateLegacyDefensiveAction(options = {}) {
  const source = options && typeof options === "object" ? options : {};
  const { actionName, currentPosture } = source;
  const nextPosture = getLegacyDefensivePosture(actionName);
  return Boolean(nextPosture && normalizeText(nextPosture) === normalizeText(currentPosture));
}

export function getLegacyDefensiveDuplicateMessage({ actorName, actionName } = {}) {
  const name = toDisplayName(actorName);
  const posture = getLegacyDefensivePosture(actionName);
  const label = posture === "Block" ? "blocking" : posture === "Evade" ? "evading" : "defending";
  return `Already ${label}. Choose another action or End Turn.`;
}

export function getLegacyDefensiveRemainingActionMessage({ actorName, remainingActions } = {}) {
  const name = toDisplayName(actorName);
  const remaining = Math.max(0, Number(remainingActions) || 0);
  const noun = remaining === 1 ? "action" : "actions";
  return `${name} has ${remaining} ${noun} remaining. Choose another action or End Turn.`;
}

export function shouldClearLegacySelectedAction(actionName) {
  return isLegacyDefensiveAction(actionName);
}

export function isExplicitManualEndTurnSource(source) {
  return EXPLICIT_MANUAL_END_TURN_SOURCES.has(normalizeText(source));
}

export function canUseManualEndTurn(options = {}) {
  const safeOptions = options && typeof options === "object" ? options : {};
  const {
    source = "",
    currentFighter = null,
    commandTurn = null,
    aiControlEnabled = false,
  } = safeOptions;
  if (!isExplicitManualEndTurnSource(source)) return false;
  const explicitControlMode = getExplicitCombatantControlMode(currentFighter, commandTurn?.turnEntry);
  const isEnemy =
    isEnemyCombatant(currentFighter, commandTurn?.turnEntry || { side: commandTurn?.activeActorTeam }) ||
    commandTurn?.isEnemyControlled === true ||
    currentFighter?.aiControlled === true;
  if (isEnemy && explicitControlMode !== "manual") return false;
  if (commandTurn?.isPlayerControlled === false) return false;
  return isManualPlayerCombatant(currentFighter, {
    related: commandTurn?.turnEntry || { side: commandTurn?.activeActorTeam },
    aiControlEnabled,
  });
}

export function endManualTurnActions(fighters = [], currentFighter = null) {
  if (!Array.isArray(fighters)) return fighters;
  const currentId = getId(currentFighter);
  if (!currentId) return fighters;
  return fighters.map((fighter) => {
    if (getId(fighter) !== currentId) return fighter;
    return {
      ...fighter,
      remainingActions: 0,
    };
  });
}

export function canStartManualMovementTargeting({
  combatActive = false,
  combatOver = false,
  currentFighter = null,
  currentTurnEntry = null,
  selectedMovementFighter = null,
  selectedMovementMode = null,
  selectedAction = null,
  explicitMovementRequest = false,
} = {}) {
  if (!combatActive || combatOver) return false;
  if (!explicitMovementRequest) return false;

  const currentFighterId = getId(currentFighter);
  const currentTurnId = getId(currentTurnEntry) || currentFighterId;
  const movementFighterId = getId(selectedMovementFighter);
  if (!currentFighterId || !currentTurnId || !movementFighterId) return false;
  if (movementFighterId !== currentFighterId || movementFighterId !== currentTurnId) return false;

  const control = normalizeText(currentFighter?.controlMode || currentFighter?.controller || currentFighter?.type);
  if (isEnemyCombatant(currentFighter, currentTurnEntry) || control === "enemy" || currentFighter?.aiControlled === true) return false;

  const mode = normalizeText(selectedMovementMode);
  if (!MOVEMENT_TYPES.has(mode)) return false;

  const actionType = normalizeText(selectedAction?.type);
  const actionName = normalizeText(selectedAction?.name || selectedAction?.label || selectedAction);
  const actionKey = actionType || actionName;
  if (NON_MOVEMENT_ACTIONS.has(actionKey) || NON_MOVEMENT_ACTIONS.has(actionName)) return false;
  if (actionKey && !MOVEMENT_TYPES.has(actionKey) && !MOVEMENT_TYPES.has(actionName)) return false;

  return true;
}

export function buildClearedMovementState(state = {}) {
  const source = state && typeof state === "object" ? state : {};
  return {
    ...source,
    movementMode: { active: false, isRunning: false },
    selectedMovementMode: null,
    selectedMovementFighter: null,
    selectedMovementHex: null,
    selectedHex: null,
    showMovementSelection: false,
    validMoves: cloneArray(source.validMoves),
    engineValidMoves: cloneArray(source.engineValidMoves),
    pendingMoveCosts: {},
    moveCostsByHex: {},
    hoveredHex: null,
    hoveredCell: null,
    targetingMode: null,
    explicitMovementRequest: false,
    manualMovementRequestActive: false,
  };
}

export function buildClearedAttackAbortState(state = {}, options = {}) {
  const source = state && typeof state === "object" ? state : {};
  const clearLegacySelection = options.clearLegacySelection !== false;
  const next = {
    ...source,
    activeAttack: null,
    activeAttackActionId: null,
    turnActionResolving: false,
    executingAction: false,
    pendingTurnAdvance: false,
    targetingMode: null,
    showCombatChoices: false,
    selectedMovementHex: null,
  };

  if (clearLegacySelection) {
    next.selectedAction = null;
    next.selectedWeapon = null;
    next.selectedAttackWeapon = null;
    next.selectedManeuver = null;
  }

  if (options.clearSelectedTarget === true) {
    next.selectedTarget = null;
  }

  if (options.clearSelectedCombatAction === true) {
    next.selectedCombatAction = null;
  }

  return next;
}

export function buildClearedLegacyDefensiveActionState(state = {}, options = {}) {
  const source = state && typeof state === "object" ? state : {};
  const shouldClearSelection =
    options.clearSelectedAction === true ||
    shouldClearLegacySelectedAction(source.selectedAction);
  const next = {
    ...source,
    activeAttack: null,
    activeAttackActionId: null,
    activeGrappleActionId: null,
    activeTechnique: null,
    turnActionResolving: false,
    executingAction: false,
    pendingTurnAdvance: false,
    targetingMode: null,
    selectedMovementMode: null,
    selectedMovementFighter: null,
    selectedMovementHex: null,
    showMovementSelection: false,
    movementMode: { active: false, isRunning: false },
    explicitMovementRequest: false,
    manualMovementRequestActive: false,
  };

  if (shouldClearSelection) {
    next.selectedAction = null;
  }

  if (options.clearSelectedTarget !== false) {
    next.selectedTarget = null;
  }

  if (options.clearSelectedWeapon !== false) {
    next.selectedWeapon = null;
    next.selectedAttackWeapon = null;
  }

  if (options.clearSelectedCombatAction === true) {
    next.selectedCombatAction = null;
  }

  return next;
}

export function sanitizeBusyStateAfterAbort(state = {}) {
  const source = state && typeof state === "object" ? state : {};
  return {
    ...source,
    activeAttack: null,
    activeAttackActionId: null,
    turnActionResolving: false,
    executingAction: false,
    pendingTurnAdvance: false,
  };
}

export default {
  buildClearedLegacyDefensiveActionState,
  buildClearedAttackAbortState,
  buildClearedMovementState,
  canStartManualMovementTargeting,
  canUseManualEndTurn,
  endManualTurnActions,
  getLegacyDefensiveDuplicateMessage,
  getLegacyDefensivePosture,
  getLegacyDefensiveRemainingActionMessage,
  isExplicitManualEndTurnSource,
  isDuplicateLegacyDefensiveAction,
  isLegacyDefensiveAction,
  sanitizeBusyStateAfterAbort,
  shouldClearLegacySelectedAction,
};
