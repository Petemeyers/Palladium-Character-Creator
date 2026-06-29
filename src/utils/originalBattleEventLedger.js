export const ORIGINAL_BATTLE_EVENT_TYPES = Object.freeze({
  ENCOUNTER_STARTED: "encounter_started",
  ACTOR_DAMAGED: "actor_damaged",
  ACTOR_WOUNDED: "actor_wounded",
  ACTOR_ROUTED: "actor_routed",
  ACTOR_DEFEATED: "actor_defeated",
  LINE_HELD: "line_held",
  DUEL_WON: "duel_won",
  MONSTER_DREAD_SURVIVED: "monster_dread_survived",
  ENCOUNTER_ENDED: "encounter_ended",
});

const normalizeText = (value) => String(value || "").trim();
const normalizeType = (value) => normalizeText(value).toLowerCase().replace(/[\s-]+/g, "_") || "battle_event";

const getActorId = (actor) => normalizeText(
  actor?.id || actor?._id || actor?.fighterId || actor?.characterId
);

const getActorName = (actor) => {
  const name = normalizeText(actor?.name || actor?.displayName);
  return name || "Unnamed actor";
};

const toWholeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
};

const cloneDetails = (details) => {
  if (!details || typeof details !== "object" || Array.isArray(details)) return {};
  try {
    return JSON.parse(JSON.stringify(details));
  } catch (_error) {
    return {};
  }
};

const defaultEventId = ({ type, actorId, timestamp, sequence }) => {
  const subject = normalizeText(actorId || "encounter").replace(/[^a-zA-Z0-9_-]+/g, "-") || "encounter";
  return `${type}-${subject}-${timestamp}-${sequence}`;
};

export function createOriginalBattleEvent(input = {}, options = {}) {
  const actor = input.actor && typeof input.actor === "object" ? input.actor : null;
  const sourceActor = input.sourceActor && typeof input.sourceActor === "object" ? input.sourceActor : null;
  const type = normalizeType(input.type || input.eventType || input.kind);
  const actorId = normalizeText(input.actorId) || getActorId(actor);
  const actorName = normalizeText(input.actorName) || getActorName(actor);
  const sourceActorId = normalizeText(input.sourceActorId) || getActorId(sourceActor) || null;
  const explicitSourceName = normalizeText(input.sourceActorName);
  const sourceActorName = explicitSourceName || (sourceActor ? getActorName(sourceActor) : null);
  const now = typeof options.now === "function" ? options.now : Date.now;
  const timestamp = Number.isFinite(Number(input.timestamp)) ? Number(input.timestamp) : Number(now());
  const sequence = toWholeNumber(options.sequence, 0);
  const idFactory = typeof options.idFactory === "function" ? options.idFactory : defaultEventId;
  const generatedId = idFactory({ type, actorId, timestamp, sequence, input });

  return {
    id: normalizeText(input.id) || normalizeText(generatedId) || defaultEventId({ type, actorId, timestamp, sequence }),
    type,
    actorId,
    actorName,
    sourceActorId,
    sourceActorName,
    round: toWholeNumber(input.round, 0),
    turn: toWholeNumber(input.turn, 0),
    timestamp: Number.isFinite(timestamp) ? timestamp : 0,
    details: cloneDetails(input.details),
  };
}

export function createOriginalBattleEventLedger(initialEvents = [], options = {}) {
  if (!Array.isArray(initialEvents)) return [];
  return initialEvents.map((event, index) => createOriginalBattleEvent(event, {
    ...options,
    sequence: index,
  }));
}

export function appendOriginalBattleEvent(ledger = [], event = {}, options = {}) {
  const currentLedger = Array.isArray(ledger) ? ledger : [];
  const nextEvent = createOriginalBattleEvent(event, {
    ...options,
    sequence: currentLedger.length,
  });
  return [...currentLedger, nextEvent];
}

export const recordOriginalBattleEvent = appendOriginalBattleEvent;

export function getOriginalBattleEventsByType(ledger = [], type = "") {
  const targetType = normalizeType(type);
  return (Array.isArray(ledger) ? ledger : [])
    .filter((event) => normalizeType(event?.type) === targetType)
    .map((event) => createOriginalBattleEvent(event));
}

export function getOriginalBattleEventsForActor(ledger = [], actorId = "", options = {}) {
  const targetId = normalizeText(actorId);
  if (!targetId) return [];
  const includeAsSource = options.includeAsSource === true;
  return (Array.isArray(ledger) ? ledger : [])
    .filter((event) => (
      normalizeText(event?.actorId) === targetId ||
      (includeAsSource && normalizeText(event?.sourceActorId) === targetId)
    ))
    .map((event) => createOriginalBattleEvent(event));
}

export default {
  ORIGINAL_BATTLE_EVENT_TYPES,
  appendOriginalBattleEvent,
  createOriginalBattleEvent,
  createOriginalBattleEventLedger,
  getOriginalBattleEventsByType,
  getOriginalBattleEventsForActor,
  recordOriginalBattleEvent,
};
