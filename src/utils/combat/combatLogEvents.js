export const COMBAT_LOG_AUDIENCES = Object.freeze({
  PLAYER: "player",
  DEVELOPER: "developer",
  BOTH: "both",
});

export const COMBAT_LOG_CHANNELS = Object.freeze({
  TURN: "turn",
  ACTION: "action",
  ROLL: "roll",
  DAMAGE: "damage",
  MOVEMENT: "movement",
  STATUS: "status",
  OUTCOME: "outcome",
  SYSTEM: "system",
  AI: "ai",
  EXECUTION: "execution",
  STATE: "state",
  VALIDATION: "validation",
  WARNING: "warning",
  ERROR: "error",
});

const PLAYER_LEGACY_TYPES = new Set([
  "combat",
  "hit",
  "miss",
  "critical",
  "damage",
  "victory",
  "defeat",
  "initiative",
  "success",
]);

const DEVELOPER_LEGACY_TYPES = new Set([
  "debug",
  "system",
  "ai",
  "execution",
  "state",
  "validation",
]);

export function createCombatLogId({ prefix = "combat-log", sequence, now = Date.now } = {}) {
  const suffix = sequence != null ? String(sequence) : `${now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
}

export function getLegacyCombatLogAudience(type, explicitTypeProvided = false) {
  if (!explicitTypeProvided) return COMBAT_LOG_AUDIENCES.DEVELOPER;
  if (PLAYER_LEGACY_TYPES.has(type)) return COMBAT_LOG_AUDIENCES.BOTH;
  if (DEVELOPER_LEGACY_TYPES.has(type)) return COMBAT_LOG_AUDIENCES.DEVELOPER;
  return COMBAT_LOG_AUDIENCES.DEVELOPER;
}

export function getLegacyCombatLogChannel(type) {
  switch (type) {
    case "combat":
    case "initiative":
      return COMBAT_LOG_CHANNELS.TURN;
    case "hit":
    case "miss":
    case "critical":
      return COMBAT_LOG_CHANNELS.ROLL;
    case "damage":
      return COMBAT_LOG_CHANNELS.DAMAGE;
    case "victory":
    case "defeat":
    case "success":
      return COMBAT_LOG_CHANNELS.OUTCOME;
    case "ai":
      return COMBAT_LOG_CHANNELS.AI;
    case "execution":
      return COMBAT_LOG_CHANNELS.EXECUTION;
    case "state":
      return COMBAT_LOG_CHANNELS.STATE;
    case "validation":
      return COMBAT_LOG_CHANNELS.VALIDATION;
    case "error":
      return COMBAT_LOG_CHANNELS.ERROR;
    case "warning":
      return COMBAT_LOG_CHANNELS.WARNING;
    default:
      return COMBAT_LOG_CHANNELS.SYSTEM;
  }
}

export function normalizeCombatLogEntry(entry, {
  id,
  sequence,
  timestamp = Date.now(),
  displayTimestamp,
  legacyType = "info",
  explicitTypeProvided = false,
  diceInfo = null,
  round = null,
  turn = null,
} = {}) {
  if (typeof entry === "string") {
    const audience = getLegacyCombatLogAudience(legacyType, explicitTypeProvided);
    return {
      id: id ?? createCombatLogId({ sequence }),
      seq: sequence,
      timestamp,
      displayTimestamp,
      audience,
      channel: getLegacyCombatLogChannel(legacyType),
      eventType: "legacy-message",
      level: legacyType === "error" ? "error" : legacyType === "warning" ? "warning" : "info",
      type: legacyType,
      round,
      turn,
      message: entry,
      data: {},
      diceInfo,
    };
  }

  const input = entry && typeof entry === "object" ? entry : { message: String(entry ?? "") };
  const level = input.level ?? input.type ?? legacyType ?? "info";
  const channel = input.channel ?? getLegacyCombatLogChannel(input.type ?? legacyType);
  return {
    id: input.id ?? id ?? createCombatLogId({ sequence }),
    seq: input.seq ?? sequence,
    timestamp: input.timestamp ?? timestamp,
    displayTimestamp: input.displayTimestamp ?? displayTimestamp,
    audience: input.audience ?? COMBAT_LOG_AUDIENCES.DEVELOPER,
    channel,
    eventType: input.eventType ?? "legacy-message",
    level,
    type: input.type ?? level,
    actorId: input.actorId,
    targetId: input.targetId,
    round: input.round ?? round,
    turn: input.turn ?? turn,
    message: input.message ?? "",
    data: input.data ?? {},
    diceInfo: input.diceInfo ?? diceInfo,
  };
}

export function selectPlayerCombatEvents(events = []) {
  return events.filter((event) => (
    event?.audience === COMBAT_LOG_AUDIENCES.PLAYER ||
    event?.audience === COMBAT_LOG_AUDIENCES.BOTH
  ));
}

export function selectDeveloperCombatEvents(events = []) {
  return events.filter((event) => (
    event?.audience === COMBAT_LOG_AUDIENCES.DEVELOPER ||
    event?.audience === COMBAT_LOG_AUDIENCES.BOTH
  ));
}

export function selectCombatEventsByAudience(events = [], audienceMode = COMBAT_LOG_AUDIENCES.PLAYER) {
  if (audienceMode === "all") return events;
  if (audienceMode === COMBAT_LOG_AUDIENCES.DEVELOPER) {
    return selectDeveloperCombatEvents(events);
  }
  return selectPlayerCombatEvents(events);
}

export function selectCombatEventsByChannel(events = [], channelOrGroup = "all") {
  if (channelOrGroup === "all") return events;
  if (channelOrGroup === "player") return selectPlayerCombatEvents(events);
  if (channelOrGroup === "warnings") return events.filter((event) => event.level === "warning" || event.channel === COMBAT_LOG_CHANNELS.WARNING);
  if (channelOrGroup === "errors") return events.filter((event) => event.level === "error" || event.channel === COMBAT_LOG_CHANNELS.ERROR);
  return events.filter((event) => event.channel === channelOrGroup || event.type === channelOrGroup || event.eventType === channelOrGroup);
}
