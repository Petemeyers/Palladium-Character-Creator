import assert from "node:assert/strict";

import {
  createBatchDispatcher,
  processDueScheduleEvents,
} from "../src/utils/combat/processScheduledEventBatch.js";
import { buildCombatLogText } from "../src/utils/combat/combatLogExport.js";

function createFixtureEvents(count = 240) {
  return Array.from({ length: count }, (_, index) => {
    const actorId = `fighter-${index % 8}`;
    if (index % 7 === 0) {
      return { type: "HP_DELTA", actorId, amount: -((index % 5) + 1), message: `${actorId} loses health` };
    }
    if (index % 5 === 0) {
      return { type: "PROJECTILE_DONE", id: `arrow-${index}` };
    }
    if (index % 3 === 0) {
      return { type: "LOG", message: `event ${index}`, channel: index % 2 === 0 ? "player" : "developer" };
    }
    return { type: "MOVED", eid: actorId, to: { x: index % 17, y: Math.floor(index / 17) } };
  });
}

function reducePresentation(state, event) {
  const next = {
    positions: { ...state.positions },
    hp: { ...state.hp },
    projectilesDone: [...state.projectilesDone],
    canonicalEvents: [...state.canonicalEvents],
    seq: state.seq,
  };

  if ((event.type === "MOVED" || event.type === "HEX_MOVED") && event.eid && event.to) {
    next.positions[event.eid] = { x: event.to.x, y: event.to.y };
  }
  if (event.type === "HP_DELTA" && event.actorId) {
    next.hp[event.actorId] = (next.hp[event.actorId] ?? 100) + event.amount;
  }
  if (event.type === "PROJECTILE_DONE") {
    next.projectilesDone.push(event.id);
  }

  const seq = next.seq + 1;
  next.seq = seq;
  next.canonicalEvents.push({
    seq,
    timestamp: "12:00:00 PM",
    audience: event.channel === "developer" ? "developer" : "player",
    channel: event.channel || "timeline",
    type: event.type,
    eventType: event.type,
    level: "info",
    actorId: event.actorId || event.eid,
    message: event.message || `${event.type} ${event.actorId || event.eid || event.id || seq}`,
  });
  return next;
}

function initialState() {
  return {
    positions: {},
    hp: {},
    projectilesDone: [],
    canonicalEvents: [],
    seq: 0,
  };
}

const fixture = createFixtureEvents();
const perEventState = fixture.reduce(reducePresentation, initialState());

let batchState = initialState();
let batchCallbacks = 0;
const dispatchBatch = createBatchDispatcher({
  onEventBatch: (events) => {
    batchCallbacks += 1;
    for (const event of events) {
      batchState = reducePresentation(batchState, event);
    }
  },
});

const schedules = new Map([
  ["fixture", {
    cursor: 0,
    baseMs: 0,
    items: fixture.map((event, index) => ({ t: index, e: event })),
  }],
]);

while (schedules.size > 0) {
  processDueScheduleEvents({
    playheadMs: 1000,
    schedules,
    scheduleMeta: new Map(),
    dispatchBatch,
    maxEvents: 64,
    maxProcessingMs: 1000,
  });
}

assert.deepEqual(batchState.positions, perEventState.positions, "batched positions should match per-event positions");
assert.deepEqual(batchState.hp, perEventState.hp, "batched fighter display health should match per-event health");
assert.deepEqual(batchState.projectilesDone, perEventState.projectilesDone, "batched projectile completion should match per-event completion");
assert.deepEqual(
  batchState.canonicalEvents.map((event) => event.seq),
  perEventState.canonicalEvents.map((event) => event.seq),
  "stable sequence IDs should match",
);
assert.equal(batchState.canonicalEvents.length, perEventState.canonicalEvents.length, "canonical event count should match");
assert.equal(
  buildCombatLogText(batchState.canonicalEvents),
  buildCombatLogText(perEventState.canonicalEvents),
  "Copy Entire Log text should match batched and per-event delivery",
);
assert.ok(batchCallbacks < fixture.length, "batch delivery should use fewer callbacks than per-event delivery");

console.log("✅ clock batch/per-event equivalence Phase 2 tests passed");
