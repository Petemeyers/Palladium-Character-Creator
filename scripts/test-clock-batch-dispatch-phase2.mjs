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
  telemetryRef: { current: { eventsDelivered: 0, batchesDelivered: 0, largestBatchSize: 0 } },
});

const schedules = new Map([
  ["s1", {
    cursor: 0,
    baseMs: 0,
    items: [
      { t: 0, e: { type: "A" } },
      { t: 1, e: { type: "B" } },
      { t: 2, e: { type: "C", delivery: { immediate: true } } },
      { t: 3, e: { type: "D" } },
    ],
  }],
]);
const meta = new Map([["s1", { kind: "test" }]]);

const result = processDueScheduleEvents({
  playheadMs: 100,
  schedules,
  scheduleMeta: meta,
  dispatchBatch,
  maxEvents: 20,
  maxProcessingMs: 1000,
  source: "test",
});

assert.equal(result.delivered, 4);
assert.deepEqual(delivered, ["A", "B", "C", "D"], "batch delivery preserves event order");
assert.deepEqual(batches.map((batch) => batch.events), [["A", "B"], ["C"], ["D"]], "immediate events split safe batch segments");
assert.deepEqual(historyRef.current.map((entry) => entry.event.type), ["A", "B", "C", "D"], "debug history appends in order");
assert.equal(schedules.size, 0, "completed schedule is removed");

console.log("✅ clock batch dispatch Phase 2 tests passed");
