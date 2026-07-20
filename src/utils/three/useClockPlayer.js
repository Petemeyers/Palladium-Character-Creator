import { useCallback, useEffect, useRef, useState } from "react";
import {
  createBatchDispatcher,
  processDueScheduleEvents,
} from "../combat/processScheduledEventBatch.js";
import {
  createTimelinePerformanceTelemetry,
  formatTimelinePerformanceSummary,
  recordEngineCallDuration,
} from "../combat/combatPerformanceTelemetry.js";

const defaultEngineCall = (method, payload) =>
  (typeof window !== "undefined" && window?.engine?.call)
    ? window.engine.call(method, payload)
    : Promise.resolve({ ok: false, error: { message: "Engine not available" } });

const DEBUG_CLOCK =
  typeof window !== "undefined" &&
  window.localStorage?.getItem("debugClock") === "true";

const timestampNow = () => {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
};

/**
 * Clock player for SCHEDULED_EVENTS emitted by engine worker.
 *
 * Features:
 * - pause/resume
 * - live speed changes
 * - cancel schedule(s)
 * - optional batch delivery via onEventBatch
 * - ENGINE_CALL execution blocks later items until done
 * - optional step forward/back debugging
 */
export function useClockPlayer({
  onEvent,
  onEventBatch,
  replaceMode = true,
  onCancelSchedule,
  engineCall,
  maxEventsPerFrame = 250,
  maxProcessingMsPerFrame = 6,
}) {
  const rafRef = useRef(null);

  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);

  const schedulesRef = useRef(new Map());
  const scheduleMetaRef = useRef(new Map());
  const playheadRef = useRef(0);
  const lastRealRef = useRef(null);

  const historyRef = useRef([]);
  const maxHistory = DEBUG_CLOCK ? 5000 : 250;
  const telemetryRef = useRef(createTimelinePerformanceTelemetry());

  const onEventRef = useRef(onEvent);
  const onEventBatchRef = useRef(onEventBatch);
  useEffect(() => {
    onEventRef.current = onEvent;
    onEventBatchRef.current = onEventBatch;
  }, [onEvent, onEventBatch]);

  const engineCallRef = useRef(engineCall ?? defaultEngineCall);
  useEffect(() => {
    engineCallRef.current = engineCall ?? defaultEngineCall;
  }, [engineCall]);

  const dispatchBatch = useCallback((events, metadata = {}) => {
    const dispatcher = createBatchDispatcher({
      onEvent: onEventRef.current,
      onEventBatch: onEventBatchRef.current,
      historyRef,
      playheadRef,
      maxHistory,
      debug: DEBUG_CLOCK,
      telemetryRef,
    });
    return dispatcher(events, metadata);
  }, [maxHistory]);

  const dispatchBatchRef = useRef(dispatchBatch);
  useEffect(() => {
    dispatchBatchRef.current = dispatchBatch;
  }, [dispatchBatch]);

  const clearAll = useCallback(() => {
    for (const [id, meta] of scheduleMetaRef.current.entries()) {
      onCancelSchedule?.(id, meta, "clearAll");
    }
    schedulesRef.current.clear();
    scheduleMetaRef.current.clear();
    playheadRef.current = 0;
    lastRealRef.current = null;
    historyRef.current = [];
    telemetryRef.current = createTimelinePerformanceTelemetry();
  }, [onCancelSchedule]);

  const cancelSchedule = useCallback((id) => {
    const meta = scheduleMetaRef.current.get(id);
    onCancelSchedule?.(id, meta, "cancelSchedule");
    schedulesRef.current.delete(id);
    scheduleMetaRef.current.delete(id);
  }, [onCancelSchedule]);

  const cancelByPrefix = useCallback((prefix) => {
    for (const id of schedulesRef.current.keys()) {
      if (id.startsWith(prefix)) {
        const meta = scheduleMetaRef.current.get(id);
        onCancelSchedule?.(id, meta, "cancelByPrefix");
        schedulesRef.current.delete(id);
        scheduleMetaRef.current.delete(id);
      }
    }
  }, [onCancelSchedule]);

  const cancelByKind = useCallback((kind) => {
    for (const [id, meta] of scheduleMetaRef.current.entries()) {
      if (meta?.kind === kind) {
        onCancelSchedule?.(id, meta, "cancelByKind");
        schedulesRef.current.delete(id);
        scheduleMetaRef.current.delete(id);
      }
    }
  }, [onCancelSchedule]);

  const cancelByOwner = useCallback((ownerType, ownerId) => {
    for (const [id, meta] of scheduleMetaRef.current.entries()) {
      if (meta?.owner?.type === ownerType && meta?.owner?.id === ownerId) {
        onCancelSchedule?.(id, meta, "cancelByOwner");
        schedulesRef.current.delete(id);
        scheduleMetaRef.current.delete(id);
      }
    }
  }, [onCancelSchedule]);

  const addSchedule = useCallback((scheduleEvent) => {
    const { id, items, kind, owner, locks } = scheduleEvent || {};
    if (!id || !Array.isArray(items)) return;

    if (replaceMode) {
      for (const [existingId, meta] of scheduleMetaRef.current.entries()) {
        onCancelSchedule?.(existingId, meta, "replaceMode");
      }
      schedulesRef.current.clear();
      scheduleMetaRef.current.clear();
      playheadRef.current = 0;
      lastRealRef.current = null;
      historyRef.current = [];
    }

    const sorted = [...items].sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
    schedulesRef.current.set(id, {
      baseMs: 0,
      cursor: 0,
      items: sorted,
      generation: (schedulesRef.current.get(id)?.generation || 0) + 1,
    });
    scheduleMetaRef.current.set(id, {
      kind: kind || "unknown",
      owner: owner || null,
      locks: locks || [],
    });
  }, [onCancelSchedule, replaceMode]);

  const startEngineCall = useCallback(({
    scheduleId,
    sched,
    cursor,
    event,
    metadata,
    playheadMs,
    frameTimestamp,
    source,
  }) => {
    const { method, payload } = event;
    const castId = payload?.meta?.castId ?? "none";
    const caster = payload?.caster ?? "?";
    const target = typeof payload?.target === "string" ? payload.target : payload?.target?.id ?? "?";

    dispatchBatchRef.current?.([{
      type: "LOG",
      level: "info",
      message: `ENGINE_CALL ${method} castId=${castId} caster=${caster} target=${target}`,
    }], {
      scheduleId,
      frameTimestamp,
      playheadMs,
      source,
      engineCallMethod: method,
      owner: metadata?.owner,
      kind: "engine-call-start",
    });

    const startedAt = timestampNow();
    engineCallRef.current(method, payload)
      .then((res) => {
        const latest = schedulesRef.current.get(scheduleId);
        if (!latest || latest !== sched || latest.cursor !== cursor || !latest.engineCallInFlight) {
          return;
        }

        const returnedEvents = Array.isArray(res?.events) ? res.events : [];
        if (returnedEvents.length > 0) {
          dispatchBatchRef.current?.(returnedEvents, {
            scheduleId,
            frameTimestamp,
            playheadMs: playheadRef.current,
            source: "engine-call-result",
            engineCallMethod: method,
            owner: metadata?.owner,
            kind: "engine-call-result",
          });
        }

        const returnedTypes = DEBUG_CLOCK
          ? returnedEvents.map((item) => item?.type).filter(Boolean)
          : [];
        dispatchBatchRef.current?.([{
          type: "LOG",
          level: "info",
          message: DEBUG_CLOCK
            ? `ENGINE_CALL ${method} returned ${returnedTypes.length} events: ${returnedTypes.join(", ") || "(none)"}`
            : `ENGINE_CALL ${method} returned ${returnedEvents.length} events`,
        }], {
          scheduleId,
          frameTimestamp,
          playheadMs: playheadRef.current,
          source: "engine-call-complete",
          engineCallMethod: method,
          owner: metadata?.owner,
          kind: "engine-call-complete",
        });
      })
      .catch((err) => {
        const latest = schedulesRef.current.get(scheduleId);
        if (!latest || latest !== sched || latest.cursor !== cursor || !latest.engineCallInFlight) {
          return;
        }
        dispatchBatchRef.current?.([{
          type: "LOG",
          level: "error",
          message: `ENGINE_CALL ${method} failed: ${err?.message ?? String(err)}`,
        }], {
          scheduleId,
          frameTimestamp,
          playheadMs: playheadRef.current,
          source: "engine-call-error",
          engineCallMethod: method,
          owner: metadata?.owner,
          kind: "engine-call-error",
        });
      })
      .finally(() => {
        recordEngineCallDuration(telemetryRef.current, timestampNow() - startedAt);
        const latest = schedulesRef.current.get(scheduleId);
        if (latest && latest === sched) {
          latest.engineCallInFlight = false;
          latest.cursor = cursor + 1;
        }
      });
  }, []);

  const processDue = useCallback((frameTimestamp, source = "tick") => processDueScheduleEvents({
    playheadMs: playheadRef.current,
    schedules: schedulesRef.current,
    scheduleMeta: scheduleMetaRef.current,
    dispatchBatch: dispatchBatchRef.current,
    startEngineCall,
    maxEvents: maxEventsPerFrame,
    maxProcessingMs: maxProcessingMsPerFrame,
    frameTimestamp,
    source,
    telemetry: telemetryRef.current,
  }), [maxEventsPerFrame, maxProcessingMsPerFrame, startEngineCall]);

  const tick = useCallback((realNow) => {
    if (isPaused) {
      lastRealRef.current = realNow;
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const last = lastRealRef.current ?? realNow;
    const deltaReal = realNow - last;
    lastRealRef.current = realNow;
    playheadRef.current += deltaReal * Math.max(0, speed);
    processDue(realNow, "tick");

    rafRef.current = requestAnimationFrame(tick);
  }, [isPaused, processDue, speed]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [tick]);

  const stepForward = useCallback((ms = 16) => {
    playheadRef.current += ms;
    return processDue(null, "stepForward");
  }, [processDue]);

  const stepBack = useCallback((ms = 120) => {
    playheadRef.current = Math.max(0, playheadRef.current - ms);
  }, []);

  return {
    addSchedule,
    isPaused,
    setIsPaused,
    speed,
    setSpeed,
    clearAll,
    cancelSchedule,
    cancelByPrefix,
    cancelByKind,
    cancelByOwner,
    stepForward,
    stepBack,
    getPlayheadMs: () => playheadRef.current,
    getHistory: () => historyRef.current.slice(),
    getPerformanceTelemetry: () => ({
      ...telemetryRef.current,
      presentationCommits: { ...telemetryRef.current.presentationCommits },
    }),
    getPerformanceSummary: () => formatTimelinePerformanceSummary(telemetryRef.current),
  };
}
