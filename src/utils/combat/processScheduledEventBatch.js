const isEngineCallEvent = (evt) =>
  evt && evt.type === "ENGINE_CALL" && typeof evt.method === "string";

const nowMs = () => {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
};

export function appendClockHistory(history, events, {
  playheadMs = 0,
  maxHistory = 250,
  debug = false,
} = {}) {
  if (!debug || !history || !Array.isArray(events) || events.length === 0) return;
  for (const event of events) {
    history.push({ atMs: playheadMs, event });
  }
  if (history.length > maxHistory) {
    history.splice(0, history.length - maxHistory);
  }
}

export function createBatchDispatcher({
  onEvent,
  onEventBatch,
  historyRef,
  playheadRef,
  maxHistory = 250,
  debug = false,
  telemetryRef = null,
} = {}) {
  return function dispatchBatch(events, metadata = {}) {
    if (!Array.isArray(events) || events.length === 0) return 0;
    appendClockHistory(historyRef?.current, events, {
      playheadMs: playheadRef?.current ?? metadata.playheadMs ?? 0,
      maxHistory,
      debug,
    });
    if (telemetryRef?.current) {
      telemetryRef.current.eventsDelivered += events.length;
      telemetryRef.current.batchesDelivered += 1;
      telemetryRef.current.largestBatchSize = Math.max(
        telemetryRef.current.largestBatchSize || 0,
        events.length,
      );
    }
    if (typeof onEventBatch === "function") {
      onEventBatch(events, metadata);
    } else if (typeof onEvent === "function") {
      for (const event of events) onEvent(event, metadata);
    }
    return events.length;
  };
}

function flushCollected(collected, dispatchBatch, metadata) {
  if (!collected.length) return 0;
  const batch = collected.splice(0, collected.length);
  return dispatchBatch(batch, metadata);
}

export function processDueScheduleEvents({
  playheadMs = 0,
  schedules,
  scheduleMeta,
  dispatchBatch,
  startEngineCall,
  maxEvents = 250,
  maxProcessingMs = 6,
  frameTimestamp = null,
  source = "tick",
  telemetry = null,
} = {}) {
  const startedAt = nowMs();
  const dueBatch = [];
  let delivered = 0;
  let hitEventLimit = false;
  let hitTimeLimit = false;
  let hitEngineBarrier = false;

  const flush = (scheduleId, extra = {}) => flushCollected(dueBatch, dispatchBatch, {
    scheduleId,
    frameTimestamp,
    playheadMs,
    source,
    ...extra,
  });

  for (const [scheduleId, sched] of schedules.entries()) {
    const items = sched.items || [];
    let cursor = sched.cursor || 0;

    while (cursor < items.length) {
      if (sched.engineCallInFlight) break;
      if (delivered >= maxEvents) {
        hitEventLimit = true;
        break;
      }
      if (nowMs() - startedAt >= maxProcessingMs) {
        hitTimeLimit = true;
        break;
      }

      const item = items[cursor];
      const t = (item?.t ?? 0) + (sched.baseMs ?? 0);
      if (t > playheadMs) break;

      const event = item.e;
      if (event?.delivery?.immediate === true) {
        flush(scheduleId, { kind: "pre-immediate" });
        dispatchBatch([event], {
          scheduleId,
          frameTimestamp,
          playheadMs,
          source,
          kind: "immediate",
        });
        delivered += 1;
        cursor += 1;
        continue;
      }

      if (isEngineCallEvent(event)) {
        flush(scheduleId, { kind: "pre-engine-call" });
        sched.cursor = cursor;
        sched.engineCallInFlight = true;
        hitEngineBarrier = true;
        startEngineCall?.({
          scheduleId,
          sched,
          cursor,
          event,
          metadata: scheduleMeta?.get?.(scheduleId) || null,
          playheadMs,
          frameTimestamp,
          source,
        });
        break;
      }

      dueBatch.push(event);
      delivered += 1;
      cursor += 1;
    }

    sched.cursor = cursor;

    if (!sched.engineCallInFlight && sched.cursor >= items.length) {
      flush(scheduleId, { kind: "schedule-complete" });
      schedules.delete(scheduleId);
      scheduleMeta?.delete?.(scheduleId);
    }

    if (hitEventLimit || hitTimeLimit || hitEngineBarrier) break;
  }

  flush(null, { kind: "frame-end" });

  if (telemetry) {
    if (hitEventLimit) telemetry.framesHitEventLimit = (telemetry.framesHitEventLimit || 0) + 1;
    if (hitTimeLimit) telemetry.framesHitTimeLimit = (telemetry.framesHitTimeLimit || 0) + 1;
  }

  return {
    delivered,
    hitEventLimit,
    hitTimeLimit,
    hitEngineBarrier,
    hasMoreDue: hitEventLimit || hitTimeLimit,
  };
}

export { isEngineCallEvent };
