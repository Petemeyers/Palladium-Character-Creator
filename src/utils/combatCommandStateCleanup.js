const cloneArray = (value) => (Array.isArray(value) ? [] : []);

const MOVEMENT_TYPES = new Set(["move", "run", "charge", "withdraw"]);
const NON_MOVEMENT_ACTIONS = new Set(["attack", "evade", "defend", "defend/hold", "block", "use item", "use-item", "use skill", "use-skill"]);

const getId = (value) => {
  if (!value || typeof value !== "object") return value ? String(value) : "";
  return String(value.id || value._id || value.fighterId || value.name || "");
};

const normalizeText = (value) => String(value || "").trim().toLowerCase();

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

  const side = normalizeText(currentTurnEntry?.side || currentFighter?.side || currentFighter?.type);
  const control = normalizeText(currentFighter?.controlMode || currentFighter?.controller || currentFighter?.type);
  if (side === "enemy" || control === "enemy" || currentFighter?.aiControlled === true) return false;

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
  buildClearedAttackAbortState,
  buildClearedMovementState,
  canStartManualMovementTargeting,
  sanitizeBusyStateAfterAbort,
};
