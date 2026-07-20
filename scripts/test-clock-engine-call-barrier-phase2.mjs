import assert from "node:assert/strict";

import {
  createBatchDispatcher,
  processDueScheduleEvents,
} from "../src/utils/combat/processScheduledEventBatch.js";

const delivered = [];
const batches = [];
const historyRef = { current: [] };
const playheadRef = { current: 100 };

const dispatchBatch = createBatchDispatcher({
  onEventBatch: (events, metadata) => {
    batches.push({ events: events.map((event) => event.type), metadata });
    delivered.push(...events.map((event) => event.type));
  },
  historyRef,
  playheadRef,
  debug: true,
});

const schedules = new Map([
  ["spell-1", {
    cursor: 0,
    baseMs: 0,
    items: [
      { t: 0, e: { type: "PRE_A" } },
      { t: 1, e: { type: "PRE_B" } },
      { t: 2, e: { type: "ENGINE_CALL", method: "resolveSpell", payload: { id: "cast-1" } } },
      { t: 3, e: { type: "POST_CALL" } },
    ],
  }],
]);
const scheduleMeta = new Map([["spell-1", { kind: "spell", owner: { type: "fighter", id: "caster" } }]]);
const startedCalls = [];

const firstPass = processDueScheduleEvents({
  playheadMs: 100,
  schedules,
  scheduleMeta,
  dispatchBatch,
  startEngineCall: (call) => {
    startedCalls.push(call);
  },
  maxEvents: 50,
  maxProcessingMs: 1000,
  source: "test",
});

assert.equal(firstPass.hitEngineBarrier, true, "ENGINE_CALL should stop the current processing pass");
assert.deepEqual(delivered, ["PRE_A", "PRE_B"], "events after ENGINE_CALL must not overtake the call");
assert.equal(startedCalls.length, 1, "ENGINE_CALL should be started exactly once");
assert.equal(schedules.get("spell-1").cursor, 2, "cursor should remain on the in-flight ENGINE_CALL");
assert.equal(schedules.get("spell-1").engineCallInFlight, true, "schedule should remain blocked while the call is in flight");

dispatchBatch([{ type: "RESULT_A" }, { type: "RESULT_B" }], {
  scheduleId: "spell-1",
  source: "engine-call-result",
  kind: "engine-call-result",
});
dispatchBatch([{ type: "ENGINE_COMPLETE" }], {
  scheduleId: "spell-1",
  source: "engine-call-complete",
  kind: "engine-call-complete",
});
schedules.get("spell-1").engineCallInFlight = false;
schedules.get("spell-1").cursor = startedCalls[0].cursor + 1;

const secondPass = processDueScheduleEvents({
  playheadMs: 100,
  schedules,
  scheduleMeta,
  dispatchBatch,
  maxEvents: 50,
  maxProcessingMs: 1000,
  source: "test-resume",
});

assert.equal(secondPass.hitEngineBarrier, false);
assert.deepEqual(
  delivered,
  ["PRE_A", "PRE_B", "RESULT_A", "RESULT_B", "ENGINE_COMPLETE", "POST_CALL"],
  "ENGINE_CALL result and completion must remain before later schedule items",
);
assert.equal(schedules.size, 0, "schedule should complete after post-call events deliver");
assert.deepEqual(
  historyRef.current.map((entry) => entry.event.type),
  delivered,
  "debug history should preserve the same ordering as delivery",
);
assert.deepEqual(batches.map((batch) => batch.events), [
  ["PRE_A", "PRE_B"],
  ["RESULT_A", "RESULT_B"],
  ["ENGINE_COMPLETE"],
  ["POST_CALL"],
]);

console.log("✅ clock ENGINE_CALL barrier Phase 2 tests passed");
