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

const DEDUPE_IDENTITY_FIELDS = Object.freeze([
  ["actorId"],
  ["targetId"],
  ["generationId"],
  ["initiativeIndex"],
  ["initiativeTurnId"],
  ["turnToken"],
  ["executionKey", "attackExecutionKey"],
  ["actionToken"],
  ["continuationKey"],
  ["actionSequence", "requestedActionSequence"],
  ["actionType"],
  ["projectileId"],
  ["grappleActionToken", "grappleToken"],
  ["castId"],
  ["hitLocation", "location"],
  ["weaponId"],
]);

function firstStableValue(event, aliases) {
  for (const key of aliases) {
    const direct = event?.[key];
    if (direct !== undefined && direct !== null && direct !== "") return direct;
    const nested = event?.data?.[key];
    if (nested !== undefined && nested !== null && nested !== "") return nested;
  }
  return null;
}

export function buildCombatLogDeduplicationFingerprint(entry, {
  readableMessage,
  legacyType = "info",
  round = null,
  turn = null,
} = {}) {
  const event = entry && typeof entry === "object" ? entry : {};
  const message = readableMessage ?? event.message ?? String(entry ?? "");
  const identity = DEDUPE_IDENTITY_FIELDS.map(([field, ...aliases]) => [
    field,
    firstStableValue(event, [field, ...aliases]),
  ]);

  return JSON.stringify([
    ["eventType", event.eventType ?? "legacy-message"],
    ["channel", event.channel ?? getLegacyCombatLogChannel(event.type ?? legacyType)],
    ["audience", event.audience ?? getLegacyCombatLogAudience(legacyType, true)],
    ["legacyType", event.type ?? legacyType],
    ["round", event.round ?? event.data?.round ?? round],
    ["turn", event.turn ?? event.data?.turn ?? turn],
    ...identity,
    ["message", message],
  ]);
}

export function shouldSuppressRecentCombatLogEvent({
  cache,
  entry,
  readableMessage,
  legacyType = "info",
  round = null,
  turn = null,
  now = Date.now(),
  dedupeWindowMs = 2000,
  retentionMs = 10000,
  maxEntries = 200,
} = {}) {
  if (!(cache instanceof Map)) return false;

  for (const [key, timestamp] of cache.entries()) {
    if (now - timestamp > retentionMs) cache.delete(key);
  }

  const fingerprint = buildCombatLogDeduplicationFingerprint(entry, {
    readableMessage,
    legacyType,
    round,
    turn,
  });
  const lastTimestamp = cache.get(fingerprint);
  if (lastTimestamp !== undefined && now - lastTimestamp < dedupeWindowMs) return true;

  cache.set(fingerprint, now);
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
  return false;
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
    generationId: input.generationId ?? input.data?.generationId,
    initiativeIndex: input.initiativeIndex ?? input.data?.initiativeIndex,
    initiativeTurnId: input.initiativeTurnId ?? input.data?.initiativeTurnId,
    turnToken: input.turnToken ?? input.data?.turnToken,
    executionKey: input.executionKey ?? input.data?.executionKey ?? input.data?.attackExecutionKey,
    actionToken: input.actionToken ?? input.data?.actionToken,
    continuationKey: input.continuationKey ?? input.data?.continuationKey,
    actionSequence: input.actionSequence ?? input.data?.actionSequence ?? input.data?.requestedActionSequence,
    actionType: input.actionType ?? input.data?.actionType,
    projectileId: input.projectileId ?? input.data?.projectileId,
    grappleActionToken: input.grappleActionToken ?? input.data?.grappleActionToken ?? input.data?.grappleToken,
    castId: input.castId ?? input.data?.castId,
    hitLocation: input.hitLocation ?? input.data?.hitLocation ?? input.data?.location,
    weaponId: input.weaponId ?? input.data?.weaponId,
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
