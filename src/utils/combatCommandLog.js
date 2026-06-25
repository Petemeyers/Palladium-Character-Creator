const COMMAND_PREFIX = "[Command Center]";

const toPlainText = (value, fallback = "") => {
  if (value === undefined || value === null || typeof value === "function") return fallback;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = String(value).trim();
    return text || fallback;
  }
  return fallback;
};

export const getCommandActorName = (actor, fallback = "Combatant") => {
  if (typeof actor === "string" || typeof actor === "number") return toPlainText(actor, fallback);
  return toPlainText(actor?.name || actor?.label, fallback);
};

export const getCommandActionName = (action, fallback = "Command") => {
  if (typeof action === "string" || typeof action === "number") return toPlainText(action, fallback);
  return toPlainText(action?.name || action?.label || action?.type, fallback);
};

export const commandSelectedLog = ({ actor, action } = {}) =>
  `${COMMAND_PREFIX} ${getCommandActorName(actor)} selected ${getCommandActionName(action)}.`;

export const commandStartedLog = ({ actor, action, detail } = {}) => {
  const suffix = toPlainText(detail);
  return `${COMMAND_PREFIX} ${getCommandActorName(actor)} begins ${getCommandActionName(action)}.${suffix ? ` ${suffix}` : ""}`;
};

export const commandCompletedLog = ({ actor, action, detail } = {}) => {
  const suffix = toPlainText(detail);
  return `${COMMAND_PREFIX} ${getCommandActorName(actor)} ${suffix || `completed ${getCommandActionName(action)}.`}`;
};

export const commandBlockedLog = ({ action, reason } = {}) =>
  `${COMMAND_PREFIX} ${getCommandActionName(action)} blocked: ${toPlainText(reason, "command unavailable.")}`;

export const commandPendingLog = ({ action, reason } = {}) =>
  `${COMMAND_PREFIX} ${getCommandActionName(action)} pending: ${toPlainText(reason, "handler not wired yet.")}`;

export const postureCommandLog = ({ actor, postureLabel } = {}) =>
  `${COMMAND_PREFIX} ${getCommandActorName(actor)} enters ${toPlainText(postureLabel, "Defensive")} Posture.`;

export const recoveryCommandLog = ({ actor, recovered } = {}) => {
  const amount = Number(recovered);
  const amountText = Number.isFinite(amount) ? ` ${amount} stamina` : " stamina";
  return `${COMMAND_PREFIX} ${getCommandActorName(actor)} recovers${amountText}.`;
};

export const movementTargetingCommandLog = ({ actor, actionType } = {}) => {
  const type = toPlainText(actionType, "move").toLowerCase();
  const label = type === "run" ? "Run" : type === "charge" ? "Charge" : "Move";
  const suffix = type === "charge" ? " Attack follow-through pending." : "";
  return `${COMMAND_PREFIX} ${getCommandActorName(actor)} begins ${label} targeting.${suffix}`;
};

export default {
  commandSelectedLog,
  commandStartedLog,
  commandCompletedLog,
  commandBlockedLog,
  commandPendingLog,
  postureCommandLog,
  recoveryCommandLog,
  movementTargetingCommandLog,
  getCommandActorName,
  getCommandActionName,
};
