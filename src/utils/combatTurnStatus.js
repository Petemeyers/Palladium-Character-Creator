import { getCombatPosture } from "./combatPosture.js";
import { getCombatantSide } from "./combatantSide.js";

const toPlainText = (value, fallback = "") => {
  if (value === undefined || value === null || typeof value === "function") return fallback;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = String(value).replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
    return text || fallback;
  }
  return fallback;
};

const toNumber = (value, fallback = 0) => {
  if (value === undefined || value === null || value === "" || typeof value === "boolean") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const sourceLabelFor = (source) => {
  if (source === "live-initiative") return "Live initiative";
  if (source === "manual-public-turn-order") return "Manual turn order";
  return "No active turn";
};

const teamLabelFor = (commandTurn = {}, activeActor = {}) => {
  const canonicalSide = getCombatantSide(activeActor, commandTurn.turnEntry || {
    side: commandTurn.activeActorTeam,
  });
  if (canonicalSide === "enemy") return "Enemy";
  if (canonicalSide === "player") return "Player";
  const raw = toPlainText(commandTurn.activeActorTeam || commandTurn.turnEntry?.side || activeActor?.side || activeActor?.type, "");
  const lower = raw.toLowerCase();
  if (lower === "enemy" || lower === "enemyarmy" || activeActor?.aiControlled === true) return "Enemy";
  if (lower === "player" || lower === "party" || lower === "playerparty") return "Player";
  return raw || "Unknown";
};

const postureLabelFor = (activeActor = {}) => {
  const combatPosture = getCombatPosture(activeActor);
  if (combatPosture?.label) return combatPosture.label;

  const legacyPosture = toPlainText(activeActor?.legacyDefensivePosture || activeActor?.defensiveStance, "");
  if (legacyPosture.toLowerCase() === "block") return "Blocking";
  if (legacyPosture.toLowerCase() === "evade") return "Evading";
  if (legacyPosture.toLowerCase() === "defend") return "Defending";
  return "None";
};

const nextStepFor = ({ commandTurn, actionsRemaining, maxActions }) => {
  if (commandTurn?.isEnemyControlled) return "Waiting for enemy action.";
  if (!commandTurn?.isPlayerControlled) return "Choose a command.";
  if (actionsRemaining <= 0) return "No actions remaining. End Turn.";
  if (maxActions > 0 && actionsRemaining < maxActions) return "Choose another action or End Turn.";
  return "Choose a command.";
};

export function buildCombatTurnStatus({
  commandTurn = {},
  activeActor = null,
  selectedCombatAction = null,
  endTurnUnavailableReason = "",
} = {}) {
  const warning = toPlainText(commandTurn?.warning, "");
  const safeEndTurnUnavailableReason = toPlainText(endTurnUnavailableReason, "");
  const actorName = toPlainText(commandTurn?.activeActorName || commandTurn?.turnEntry?.name || activeActor?.name, "");
  const actionsRemaining = toNumber(commandTurn?.remainingActions ?? commandTurn?.turnEntry?.remainingActions, 0);
  const maxActions = toNumber(commandTurn?.maxActions ?? commandTurn?.turnEntry?.maxActions, actionsRemaining);
  const hasActor = Boolean(commandTurn?.activeActorId || actorName || activeActor);
  const finalWarning = !hasActor ? "No active combatant." : warning;
  const showEndTurnButton = Boolean(hasActor && commandTurn?.isPlayerControlled && !commandTurn?.isEnemyControlled);
  const endTurnAvailable = Boolean(showEndTurnButton && !finalWarning && !safeEndTurnUnavailableReason);

  return {
    currentTurnName: actorName || "No active combatant",
    sourceLabel: sourceLabelFor(commandTurn?.source),
    teamLabel: teamLabelFor(commandTurn, activeActor || {}),
    actionsRemaining,
    maxActions,
    postureLabel: postureLabelFor(activeActor || {}),
    nextStepMessage: finalWarning || nextStepFor({ commandTurn, actionsRemaining, maxActions, selectedCombatAction }),
    isPlayerTurn: Boolean(commandTurn?.isPlayerControlled),
    isEnemyTurn: Boolean(commandTurn?.isEnemyControlled),
    showEndTurnButton,
    endTurnAvailable,
    endTurnDisabledReason: safeEndTurnUnavailableReason,
    endTurnButtonLabel: "End Turn",
    warning: finalWarning,
  };
}

export default {
  buildCombatTurnStatus,
};
