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

const getId = (value, fallback = "") =>
  cleanText(value?.id || value?._id || value?.fighterId || value?.characterId || value?.name, fallback);

const getSide = (actor = {}, turnEntry = {}) =>
  cleanText(turnEntry.side || actor.side || actor.type || actor.team || actor.role, "");

const getMaxActions = (actor = {}, turnEntry = {}) =>
  toNumber(turnEntry.maxActions) ??
  toNumber(actor.maxActions) ??
  toNumber(actor.actionsPerRound) ??
  toNumber(actor.actionsPerMelee) ??
  1;

const getRemainingActions = (actor = {}, turnEntry = {}) =>
  toNumber(turnEntry.remainingActions) ??
  toNumber(actor.remainingActions) ??
  toNumber(actor.actionsRemaining) ??
  getMaxActions(actor, turnEntry);

const isEnemySide = (actor = {}, turnEntry = {}) => {
  const side = getSide(actor, turnEntry).toLowerCase();
  return side === "enemy" || side === "enemyarmy" || actor.aiControlled === true;
};

const isPlayerSide = (actor = {}, turnEntry = {}) => {
  const side = getSide(actor, turnEntry).toLowerCase();
  return side === "player" || side === "party" || side === "playerparty";
};

const buildTurnEntry = ({ actor, sourceRow, round, initiativeIndex }) => {
  if (!actor && !sourceRow) return null;
  const row = sourceRow || {};
  const activeActorId = getId(actor, getId(row));
  return {
    id: activeActorId,
    name: cleanText(actor?.name || row.name, "Current combatant"),
    side: getSide(actor, row),
    type: cleanText(actor?.type || row.type, ""),
    round: toNumber(round) ?? toNumber(row.round) ?? 1,
    initiativeIndex: toNumber(initiativeIndex) ?? toNumber(row.initiativeIndex),
    remainingActions: getRemainingActions(actor, row),
    maxActions: getMaxActions(actor, row),
    maxStamina: toNumber(row.maxStamina) ?? toNumber(actor?.maxStamina) ?? toNumber(actor?.fatigueState?.maxStamina),
    currentStamina: toNumber(row.currentStamina) ?? toNumber(actor?.currentStamina) ?? toNumber(actor?.fatigueState?.currentStamina),
    fatigueLabel: cleanText(row.fatigueLabel || actor?.fatigueLabel || actor?.fatigueState?.status, ""),
  };
};

export function buildCombatCommandTurnBridge({
  combatActive = false,
  combatOver = false,
  liveActor = null,
  liveInitiativeIndex = null,
  liveRound = 1,
  manualTurnEntry = null,
  manualTurnOrderActive = false,
  manualRound = 1,
  aiControlEnabled = false,
} = {}) {
  const liveAvailable = Boolean(combatActive && !combatOver && liveActor);
  const source = liveAvailable
    ? "live-initiative"
    : manualTurnOrderActive && manualTurnEntry
      ? "manual-public-turn-order"
      : "none";
  const actor = liveAvailable ? liveActor : source === "manual-public-turn-order" ? manualTurnEntry : null;
  const turnEntry = source === "none"
    ? null
    : buildTurnEntry({
        actor,
        sourceRow: source === "manual-public-turn-order" ? manualTurnEntry : null,
        round: source === "live-initiative" ? liveRound : manualRound,
        initiativeIndex: source === "live-initiative" ? liveInitiativeIndex : null,
      });

  if (!turnEntry) {
    return {
      activeActorId: "",
      activeActorName: "",
      activeActorTeam: "",
      activeActorType: "",
      round: toNumber(source === "live-initiative" ? liveRound : manualRound) ?? 1,
      initiativeIndex: null,
      remainingActions: null,
      maxActions: null,
      isPlayerControlled: false,
      isEnemyControlled: false,
      source,
      warning: "No active combatant.",
      turnEntry: null,
    };
  }

  const enemyControlled = isEnemySide(actor, turnEntry);
  const playerControlled = !enemyControlled && isPlayerSide(actor, turnEntry) && !aiControlEnabled;

  return {
    activeActorId: turnEntry.id,
    activeActorName: turnEntry.name,
    activeActorTeam: turnEntry.side,
    activeActorType: turnEntry.type,
    round: turnEntry.round,
    initiativeIndex: turnEntry.initiativeIndex,
    remainingActions: turnEntry.remainingActions,
    maxActions: turnEntry.maxActions,
    isPlayerControlled: playerControlled,
    isEnemyControlled: enemyControlled || (isPlayerSide(actor, turnEntry) && aiControlEnabled),
    source,
    warning: "",
    turnEntry,
  };
}

export function selectedActionMatchesCommandTurn(selectedCombatAction = null, commandTurn = {}) {
  if (!selectedCombatAction) {
    return { ok: true, reason: "" };
  }
  const actionActorId = cleanText(selectedCombatAction?.metadata?.actorId || selectedCombatAction?.actorId, "");
  const activeActorId = cleanText(commandTurn?.activeActorId, "");
  if (!actionActorId || !activeActorId || actionActorId === activeActorId) {
    return { ok: true, reason: "" };
  }
  return {
    ok: false,
    reason: "This command can only be used by the current turn combatant.",
  };
}

export default {
  buildCombatCommandTurnBridge,
  selectedActionMatchesCommandTurn,
};
