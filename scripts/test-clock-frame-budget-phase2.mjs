import assert from "node:assert/strict";

import {
  createBatchDispatcher,
  processDueScheduleEvents,
} from "../src/utils/combat/processScheduledEventBatch.js";

const delivered = [];
const telemetry = {
  framesHitEventLimit: 0,
  framesHitTimeLimit: 0,
};
const dispatchBatch = createBatchDispatcher({
  onEventBatch: (events) => {
    delivered.push(...events.map((event) => event.index));
  },
});

const schedules = new Map([
  ["large", {
    cursor: 0,
    baseMs: 0,
    items: Array.from({ length: 10 }, (_, index) => ({
      t: index,
      e: { type: "LOG", index },
    })),
  }],
]);
const scheduleMeta = new Map([["large", { kind: "large-fixture" }]]);

const first = processDueScheduleEvents({
  playheadMs: 100,
  schedules,
  scheduleMeta,
  dispatchBatch,
  maxEvents: 3,
  maxProcessingMs: 1000,
  telemetry,
});

assert.equal(first.hitEventLimit, true, "first pass should defer when event budget is reached");
assert.deepEqual(delivered, [0, 1, 2]);
assert.equal(schedules.get("large").cursor, 3);
assert.equal(telemetry.framesHitEventLimit, 1);

while (schedules.size > 0) {
  processDueScheduleEvents({
    playheadMs: 100,
    schedules,
    scheduleMeta,
    dispatchBatch,
    maxEvents: 3,
    maxProcessingMs: 1000,
    telemetry,
  });
}

assert.deepEqual(delivered, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], "frame-budget deferral must preserve event order");
assert.equal(schedules.size, 0);
assert.equal(scheduleMeta.size, 0);
assert.ok(telemetry.framesHitEventLimit >= 3, "large schedule should report budget deferrals");

console.log("✅ clock frame-budget Phase 2 tests passed");
