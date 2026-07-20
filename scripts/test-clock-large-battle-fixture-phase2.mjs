import assert from "node:assert/strict";

import {
  createBatchDispatcher,
  processDueScheduleEvents,
} from "../src/utils/combat/processScheduledEventBatch.js";
import { createTimelinePerformanceTelemetry } from "../src/utils/combat/combatPerformanceTelemetry.js";
import { buildCombatLogText } from "../src/utils/combat/combatLogExport.js";

const FIGHTER_COUNT = 40;
const EVENT_COUNT = 10000;

function makeEvent(index) {
  const actorId = `fighter-${index % FIGHTER_COUNT}`;
  const targetId = `fighter-${(index + 13) % FIGHTER_COUNT}`;
  switch (index % 10) {
    case 0:
    case 1:
    case 2:
      return { type: "MOVED", eid: actorId, to: { x: (index * 3) % 48, y: (index * 7) % 32 } };
    case 3:
      return { type: "PROJECTILE", id: `projectile-${index}`, actorId, targetId };
    case 4:
      return { type: "EFFECT_DONE", id: `effect-${index}`, actorId };
    case 5:
      return { type: "HP_DELTA", actorId: targetId, amount: -((index % 6) + 1) };
    case 6:
      return { type: "STATUS", actorId, status: index % 20 === 0 ? "shaken" : "steady" };
    default:
      return {
        type: "LOG",
        message: `large battle event ${index}`,
        channel: index % 11 === 0 ? "developer" : "player",
        actorId,
        targetId,
      };
  }
}

function reduce(state, event) {
  if ((event.type === "MOVED" || event.type === "HEX_MOVED") && event.eid && event.to) {
    state.positions[event.eid] = { x: event.to.x, y: event.to.y };
    state.positionCommits += 1;
  }
  if (event.type === "HP_DELTA" && event.actorId) {
    state.hp[event.actorId] = (state.hp[event.actorId] ?? 100) + event.amount;
    state.fighterCommits += 1;
  }
  if (event.type === "PROJECTILE") {
    state.projectiles.push(event.id);
    state.projectileCommits += 1;
  }
  if (event.type === "EFFECT_DONE") {
    state.effects.push(event.id);
    state.effectCommits += 1;
  }
  if (event.type === "STATUS") {
    state.status[event.actorId] = event.status;
    state.fighterCommits += 1;
  }

  state.seq += 1;
  state.canonicalEvents.push({
    seq: state.seq,
    timestamp: "12:00:00 PM",
    audience: event.channel === "developer" ? "developer" : "player",
    channel: event.channel || "timeline",
    type: event.type,
    eventType: event.type,
    level: "info",
    actorId: event.actorId || event.eid,
    targetId: event.targetId,
    message: event.message || `${event.type} ${event.actorId || event.eid || event.id || state.seq}`,
  });
  return state;
}

function makeState() {
  return {
    positions: {},
    hp: {},
    status: {},
    projectiles: [],
    effects: [],
    canonicalEvents: [],
    seq: 0,
    positionCommits: 0,
    fighterCommits: 0,
    projectileCommits: 0,
    effectCommits: 0,
  };
}

const events = Array.from({ length: EVENT_COUNT }, (_, index) => makeEvent(index));
const perEvent = events.reduce(reduce, makeState());

let batched = makeState();
const telemetry = createTimelinePerformanceTelemetry();
let batchCallbacks = 0;
let presentationCommits = 0;
const dispatchBatch = createBatchDispatcher({
  onEventBatch: (batch) => {
    batchCallbacks += 1;
    const domains = new Set();
    for (const event of batch) {
      if (event.type === "MOVED" || event.type === "HEX_MOVED") domains.add("positions");
      if (event.type === "HP_DELTA" || event.type === "STATUS") domains.add("fighters");
      if (event.type === "PROJECTILE") domains.add("projectiles");
      if (event.type === "EFFECT_DONE") domains.add("effects");
      batched = reduce(batched, event);
    }
    presentationCommits += domains.size;
  },
  telemetryRef: { current: telemetry },
});

const schedules = new Map([
  ["20v20-large-fixture", {
    cursor: 0,
    baseMs: 0,
    items: events.map((event, index) => ({ t: index, e: event })),
  }],
]);
const scheduleMeta = new Map([["20v20-large-fixture", { kind: "large-battle-fixture" }]]);

while (schedules.size > 0) {
  processDueScheduleEvents({
    playheadMs: EVENT_COUNT + 1,
    schedules,
    scheduleMeta,
    dispatchBatch,
    maxEvents: 250,
    maxProcessingMs: 1000,
    telemetry,
  });
}

assert.deepEqual(batched.positions, perEvent.positions, "large fixture positions should match per-event processing");
assert.deepEqual(batched.hp, perEvent.hp, "large fixture HP presentation should match per-event processing");
assert.deepEqual(batched.status, perEvent.status, "large fixture statuses should match per-event processing");
assert.deepEqual(batched.projectiles, perEvent.projectiles, "large fixture projectile completion should match");
assert.deepEqual(batched.effects, perEvent.effects, "large fixture effects should match");
assert.equal(batched.canonicalEvents.length, EVENT_COUNT, "canonical event count should preserve every event");
assert.equal(
  buildCombatLogText(batched.canonicalEvents),
  buildCombatLogText(perEvent.canonicalEvents),
  "large fixture Copy Entire Log text should match individual delivery",
);
assert.ok(batchCallbacks < EVENT_COUNT / 100, "batch callbacks should be structurally lower than event count");
assert.ok(presentationCommits < EVENT_COUNT, "batched presentation commits should be lower than per-event presentation churn");
assert.equal(telemetry.droppedEvents, 0, "no events should be dropped");
assert.equal(telemetry.eventsDelivered, EVENT_COUNT, "telemetry should count all delivered timeline events");
assert.ok(telemetry.framesHitEventLimit > 0, "large fixture should exercise event-budget deferral");
assert.equal(schedules.size, 0);

console.log(`✅ large battle Phase 2 fixture passed: events=${EVENT_COUNT} batches=${batchCallbacks} presentationCommits=${presentationCommits}`);
