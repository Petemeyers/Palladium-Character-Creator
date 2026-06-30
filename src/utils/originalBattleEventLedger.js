import { createMythicFacingEventInputs } from "./originalActorRuntimeAwardEvents.js";

export const ORIGINAL_BATTLE_EVENT_TYPES = Object.freeze({
  COMBAT_STARTED: "combat_started",
  ACTOR_ENTERED_COMBAT: "actor_entered_combat",
  ENCOUNTER_STARTED: "encounter_started",
  ACTOR_DAMAGED: "actor_damaged",
  ACTOR_SERIOUSLY_WOUNDED: "actor_seriously_wounded",
  ACTOR_WOUNDED: "actor_wounded",
  ACTOR_ROUTED: "actor_routed",
  ACTOR_RETREAT_SURVIVED: "actor_retreat_survived",
  ACTOR_DEFEATED: "actor_defeated",
  ACTOR_DEFEATED_ENEMY: "actor_defeated_enemy",
  ACTOR_FACED_MYTHIC: "actor_faced_mythic",
  ACTOR_SURVIVED_MYTHIC_ENCOUNTER: "actor_survived_mythic_encounter",
  ACTOR_SURVIVED_COMBAT: "actor_survived_combat",
  ACTOR_HELD_FORMATION: "actor_held_formation",
  LINE_HELD: "line_held",
  DUEL_WON: "duel_won",
  MONSTER_DREAD_SURVIVED: "monster_dread_survived",
  ENCOUNTER_ENDED: "encounter_ended",
  COMBAT_ENDED: "combat_ended",
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

const isPassiveCombatant = (actor) => (
  actor?.nonCombatant === true || normalizeText(actor?.controlMode).toLowerCase() === "passive"
);

const isDefeatedCombatant = (actor) => {
  const status = normalizeText(actor?.status || actor?.condition).toLowerCase();
  const currentHP = Number(actor?.currentHP ?? actor?.currentHp ?? actor?.hp ?? actor?.HP);
  return (
    actor?.isDead === true ||
    actor?.dead === true ||
    actor?.isKO === true ||
    actor?.isDefeated === true ||
    actor?.defeated === true ||
    ["dead", "defeated"].includes(status) ||
    (Number.isFinite(currentHP) && currentHP <= 0)
  );
};

const getCombatantDetails = (actor) => ({
  team: normalizeText(actor?.team || actor?.teamId || actor?.side) || null,
  controlMode: normalizeText(actor?.controlMode) || null,
  status: normalizeText(actor?.status || actor?.condition) || null,
  currentHP: Number.isFinite(Number(actor?.currentHP ?? actor?.currentHp ?? actor?.hp ?? actor?.HP))
    ? Number(actor?.currentHP ?? actor?.currentHp ?? actor?.hp ?? actor?.HP)
    : null,
});

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

export function initializeOriginalBattleEventLedger({
  combatants = [],
  round = 1,
  turn = 0,
  details = {},
} = {}, options = {}) {
  const participants = (Array.isArray(combatants) ? combatants : [])
    .filter((actor) => actor && typeof actor === "object" && !isPassiveCombatant(actor));
  let ledger = appendOriginalBattleEvent([], {
    type: ORIGINAL_BATTLE_EVENT_TYPES.COMBAT_STARTED,
    actorName: "Encounter",
    round,
    turn,
    details: {
      ...cloneDetails(details),
      participantCount: participants.length,
    },
  }, options);

  participants.forEach((actor) => {
    ledger = appendOriginalBattleEvent(ledger, {
      type: ORIGINAL_BATTLE_EVENT_TYPES.ACTOR_ENTERED_COMBAT,
      actor,
      round,
      turn,
      details: getCombatantDetails(actor),
    }, options);
  });

  createMythicFacingEventInputs(participants, { round, turn }).forEach((event) => {
    ledger = appendOriginalBattleEvent(ledger, event, options);
  });

  return ledger;
}

export function finalizeOriginalBattleEventLedger(ledger = [], {
  combatants = [],
  round = 0,
  turn = 0,
  details = {},
} = {}, options = {}) {
  const currentLedger = createOriginalBattleEventLedger(ledger);
  if (currentLedger.some((event) => event.type === ORIGINAL_BATTLE_EVENT_TYPES.COMBAT_ENDED)) {
    return currentLedger;
  }

  const enteredActorIds = new Set(
    currentLedger
      .filter((event) => event.type === ORIGINAL_BATTLE_EVENT_TYPES.ACTOR_ENTERED_COMBAT)
      .map((event) => normalizeText(event.actorId))
      .filter(Boolean)
  );
  const actors = (Array.isArray(combatants) ? combatants : [])
    .filter((actor) => actor && typeof actor === "object")
    .filter((actor) => !isPassiveCombatant(actor) || isDefeatedCombatant(actor))
    .filter((actor) => (
      enteredActorIds.size === 0 ||
      enteredActorIds.has(getActorId(actor)) ||
      isDefeatedCombatant(actor)
    ));
  let nextLedger = appendOriginalBattleEvent(currentLedger, {
    type: ORIGINAL_BATTLE_EVENT_TYPES.COMBAT_ENDED,
    actorName: "Encounter",
    round,
    turn,
    details: {
      ...cloneDetails(details),
      participantCount: actors.length,
    },
  }, options);

  actors.forEach((actor) => {
    const defeated = isDefeatedCombatant(actor);
    nextLedger = appendOriginalBattleEvent(nextLedger, {
      type: defeated
        ? ORIGINAL_BATTLE_EVENT_TYPES.ACTOR_DEFEATED
        : ORIGINAL_BATTLE_EVENT_TYPES.ACTOR_SURVIVED_COMBAT,
      actor,
      round,
      turn,
      details: getCombatantDetails(actor),
    }, options);

    if (defeated) return;
    const actorId = getActorId(actor);
    const mythicFacingEvent = currentLedger.find((event) => (
      event.type === ORIGINAL_BATTLE_EVENT_TYPES.ACTOR_FACED_MYTHIC &&
      normalizeText(event.actorId) === actorId
    ));
    if (mythicFacingEvent) {
      nextLedger = appendOriginalBattleEvent(nextLedger, {
        type: ORIGINAL_BATTLE_EVENT_TYPES.ACTOR_SURVIVED_MYTHIC_ENCOUNTER,
        actor,
        sourceActorId: mythicFacingEvent.sourceActorId,
        sourceActorName: mythicFacingEvent.sourceActorName,
        round,
        turn,
        details: cloneDetails(mythicFacingEvent.details),
      }, options);
    }

    const fled = actor?.fled === true || normalizeText(actor?.status).toLowerCase() === "fled" ||
      normalizeText(actor?.moraleState?.status).toLowerCase() === "fled";
    if (fled) {
      if (!currentLedger.some((event) => (
        event.type === ORIGINAL_BATTLE_EVENT_TYPES.ACTOR_ROUTED &&
        normalizeText(event.actorId) === actorId
      ))) {
        nextLedger = appendOriginalBattleEvent(nextLedger, {
          type: ORIGINAL_BATTLE_EVENT_TYPES.ACTOR_ROUTED,
          actor,
          round,
          turn,
          details: getCombatantDetails(actor),
        }, options);
      }
      nextLedger = appendOriginalBattleEvent(nextLedger, {
        type: ORIGINAL_BATTLE_EVENT_TYPES.ACTOR_RETREAT_SURVIVED,
        actor,
        round,
        turn,
        details: getCombatantDetails(actor),
      }, options);
    }
  });

  return nextLedger;
}

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
  finalizeOriginalBattleEventLedger,
  getOriginalBattleEventsByType,
  getOriginalBattleEventsForActor,
  initializeOriginalBattleEventLedger,
  recordOriginalBattleEvent,
};
