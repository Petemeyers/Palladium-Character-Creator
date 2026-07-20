export function createTimelinePerformanceTelemetry() {
  return {
    eventsDelivered: 0,
    batchesDelivered: 0,
    largestBatchSize: 0,
    framesHitEventLimit: 0,
    framesHitTimeLimit: 0,
    engineCallCount: 0,
    totalEngineCallDurationMs: 0,
    canonicalLogBatches: 0,
    presentationCommits: {
      positions: 0,
      fighters: 0,
      projectiles: 0,
      effects: 0,
      narration: 0,
      focus: 0,
      audio: 0,
      log: 0,
    },
    droppedEvents: 0,
  };
}

export function recordTimelineBatch(telemetry, batchSize = 0) {
  if (!telemetry || batchSize <= 0) return telemetry;
  telemetry.eventsDelivered += batchSize;
  telemetry.batchesDelivered += 1;
  telemetry.largestBatchSize = Math.max(telemetry.largestBatchSize, batchSize);
  return telemetry;
}

export function recordEngineCallDuration(telemetry, durationMs = 0) {
  if (!telemetry) return telemetry;
  telemetry.engineCallCount += 1;
  telemetry.totalEngineCallDurationMs += Math.max(0, Number(durationMs) || 0);
  return telemetry;
}

export function getTimelinePerformanceSummary(telemetry = {}) {
  const batches = Number(telemetry.batchesDelivered || 0);
  const events = Number(telemetry.eventsDelivered || 0);
  const engineCalls = Number(telemetry.engineCallCount || 0);
  return {
    events,
    batches,
    avgBatch: batches > 0 ? events / batches : 0,
    maxBatch: Number(telemetry.largestBatchSize || 0),
    budgetDeferrals:
      Number(telemetry.framesHitEventLimit || 0) +
      Number(telemetry.framesHitTimeLimit || 0),
    engineCalls,
    avgEngineCallMs: engineCalls > 0
      ? Number(telemetry.totalEngineCallDurationMs || 0) / engineCalls
      : 0,
    dropped: Number(telemetry.droppedEvents || 0),
  };
}

export function formatTimelinePerformanceSummary(telemetry = {}) {
  const summary = getTimelinePerformanceSummary(telemetry);
  return [
    "Timeline performance:",
    `events=${summary.events}`,
    `batches=${summary.batches}`,
    `avgBatch=${summary.avgBatch.toFixed(1)}`,
    `maxBatch=${summary.maxBatch}`,
    `budgetDeferrals=${summary.budgetDeferrals}`,
    `engineCalls=${summary.engineCalls}`,
    `avgEngineCallMs=${summary.avgEngineCallMs.toFixed(1)}`,
    `dropped=${summary.dropped}`,
  ].join("\n");
}
