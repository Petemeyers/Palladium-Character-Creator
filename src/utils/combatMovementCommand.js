const MOVEMENT_LABELS = {
  move: "Move",
  run: "Run",
  charge: "Charge",
};

const MOVEMENT_MODES = new Set(Object.keys(MOVEMENT_LABELS));

const hasValue = (value) => value !== undefined && value !== null && value !== "";

const toNumber = (value) => {
  if (!hasValue(value) || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const cleanText = (value, fallback = "") => {
  if (typeof value === "string") {
    const trimmed = value.replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
    return trimmed || fallback;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
};

const getId = (value) =>
  cleanText(value?.id || value?._id || value?.fighterId || value?.characterId || value?.name, "");

const getPosition = (value) => {
  const position = value?.position || value?.mapPosition || value?.hex || value;
  const x = toNumber(position?.x);
  const y = toNumber(position?.y);
  return x !== null && y !== null ? { x, y } : null;
};

const getDistance = (from, to) => {
  if (!from || !to) return null;
  const dx = Math.abs(from.x - to.x);
  const dy = Math.abs(from.y - to.y);
  return Math.max(dx, dy) * 5;
};

export function resolveManualGroundMovementActionBudget({
  movementMode,
  remainingActions = 0,
} = {}) {
  const mode = String(movementMode || "walk").toLowerCase();
  if (mode === "charge") {
    return {
      movementMode: "charge",
      partOfCombinedAction: true,
      fullCommitment: false,
      actionCost: 0,
      finalizeAfterMovement: false,
      blocksAfterPriorMovement: true,
    };
  }
  if (mode === "run" || mode === "sprint") {
    return {
      movementMode: mode,
      partOfCombinedAction: false,
      fullCommitment: true,
      actionCost: Math.max(1, Number(remainingActions) || 1),
      finalizeAfterMovement: true,
      blocksAfterPriorMovement: true,
    };
  }
  return {
    movementMode: mode || "walk",
    partOfCombinedAction: false,
    fullCommitment: false,
    actionCost: 1,
    finalizeAfterMovement: true,
    blocksAfterPriorMovement: false,
  };
}

export function getMovementCommandPreview({ actor, action, selectedTarget } = {}) {
  const mode = cleanText(action?.type, "move").toLowerCase();
  const movementMode = MOVEMENT_MODES.has(mode) ? mode : "move";
  const actorName = cleanText(actor?.name, "Current combatant");
  const targetName = cleanText(selectedTarget?.name || selectedTarget?.label, "");
  const distanceFeet = getDistance(getPosition(actor), getPosition(selectedTarget));
  const chargeNote = movementMode === "charge" ? " Charge attack follow-through pending." : "";
  const defaultSummary =
    movementMode === "run"
      ? "Fast movement command."
      : movementMode === "charge"
        ? "Fast advance; attack follow-through pending."
        : "Standard movement command.";

  return {
    actionName: cleanText(action?.name, MOVEMENT_LABELS[movementMode]),
    movementMode,
    modeLabel: MOVEMENT_LABELS[movementMode],
    actorName,
    targetName,
    distanceFeet,
    actionCost: toNumber(action?.costActions) ?? 1,
    staminaCost: toNumber(action?.costStamina) ?? 0,
    previewSummary: cleanText(action?.previewSummary, defaultSummary) + chargeNote,
  };
}

export function canExecuteMovementCommand({
  actor,
  action,
  currentTurnEntry,
  selectedTarget,
  manualTurnActive = true,
  executionAvailable = false,
} = {}) {
  const actorId = getId(actor);
  const turnId = getId(currentTurnEntry);
  const actionActorId = cleanText(action?.metadata?.actorId, actorId);
  const remainingActions = toNumber(currentTurnEntry?.remainingActions ?? actor?.remainingActions);
  const currentStamina = toNumber(currentTurnEntry?.currentStamina ?? actor?.currentStamina);
  const actionCost = toNumber(action?.costActions) ?? 1;
  const staminaCost = toNumber(action?.costStamina) ?? 0;

  if (!manualTurnActive) {
    return { ok: false, reason: "Movement mode is unavailable." };
  }
  if (!actorId || !turnId || actorId !== turnId || (actionActorId && actionActorId !== turnId)) {
    return { ok: false, reason: "Movement can only be used by the current turn combatant." };
  }
  if (!action?.enabled) {
    return { ok: false, reason: cleanText(action?.disabledReason, "Movement action is disabled.") };
  }
  if (actionCost > 0 && (remainingActions === null || remainingActions <= 0)) {
    return { ok: false, reason: "No actions remaining. End Turn manually." };
  }
  if (staminaCost > 0 && (currentStamina === null || currentStamina < staminaCost)) {
    return { ok: false, reason: "Not enough stamina." };
  }
  if (action?.targetRequired && !selectedTarget) {
    return { ok: false, reason: "Movement target or destination required." };
  }
  if (!executionAvailable) {
    return { ok: false, reason: "Movement mode is unavailable." };
  }

  return { ok: true, reason: "" };
}

export function getMovementTargetingButtonState(options = {}) {
  const preview = getMovementCommandPreview(options);
  const guard = canExecuteMovementCommand(options);
  const label =
    preview.movementMode === "run"
      ? "Begin Run Targeting"
      : preview.movementMode === "charge"
        ? "Begin Charge Targeting"
        : "Begin Move Targeting";

  return {
    enabled: guard.ok,
    label,
    reason: guard.reason,
    movementMode: preview.movementMode,
  };
}

export function buildMovementCommandResult({ actor, action, selectedTarget, executionAvailable = false } = {}) {
  const preview = getMovementCommandPreview({ actor, action, selectedTarget });
  const guard = canExecuteMovementCommand({
    actor,
    action,
    currentTurnEntry: actor,
    selectedTarget,
    executionAvailable,
  });

  return {
    ok: guard.ok,
    preview,
    message: guard.ok ? `${preview.modeLabel} command ready.` : guard.reason,
  };
}

export default {
  buildMovementCommandResult,
  canExecuteMovementCommand,
  getMovementTargetingButtonState,
  getMovementCommandPreview,
  resolveManualGroundMovementActionBudget,
};
