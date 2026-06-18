import { useCallback, useEffect, useRef, useState } from "react";

const defaultEngineCall = (method, payload) =>
  (typeof window !== "undefined" && window?.engine?.call)
    ? window.engine.call(method, payload)
    : Promise.resolve({ ok: false, error: { message: "Engine not available" } });

const isEngineCallEvent = (evt) =>
  evt && evt.type === "ENGINE_CALL" && typeof evt.method === "string";

const DEBUG_CLOCK =
  typeof window !== "undefined" &&
  window.localStorage?.getItem("debugClock") === "true";

/**
 * Clock player for SCHEDULED_EVENTS emitted by engine worker.
 *
 * Features:
 * - pause/resume
 * - live speed changes
 * - cancel schedule(s)
 * - ENGINE_CALL execution: runs engine calls, dfocusatches returned events, blocks schedule until done
 * - optional step forward/back debugging
 */
export function useClockPlayer({ onEvent, replaceMode = true, onCancelSchedule, engineCall }) {
  const rafRef = useRef(null);

  // playback controls
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1); // 0.25 .. 4 typically

  // timeline state (refs for perf)
  const schedulesRef = useRef(new Map()); // id -> { baseMs, cursor, items }
  const scheduleMetaRef = useRef(new Map()); // id -> { kind, owner, locks }
  const playheadRef = useRef(0);
  const lastRealRef = useRef(null);

  // debugging
  const historyRef = useRef([]); // [{ atMs, event }]
  const maxHistory = DEBUG_CLOCK ? 5000 : 250;

  const clearAll = useCallback(() => {
    // Notify cancellation for all schedules
    for (const [id, meta] of scheduleMetaRef.current.entries()) {
      onCancelSchedule?.(id, meta, "clearAll");
    }
    schedulesRef.current.clear();
    scheduleMetaRef.current.clear();
    playheadRef.current = 0;
    lastRealRef.current = null;
    historyRef.current = [];
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

    // Replace mode: any new schedule flushes older ones
    // Good for now (movement = single timeline). Later set replaceMode=false for concurrent effects.
    if (replaceMode) {
      // Notify cancellation for all existing schedules
      for (const [existingId, meta] of scheduleMetaRef.current.entries()) {
        onCancelSchedule?.(existingId, meta, "replaceMode");
      }
      schedulesRef.current.clear();
      scheduleMetaRef.current.clear();
      playheadRef.current = 0;
      lastRealRef.current = null;
      historyRef.current = [];
    }

    // Ensure sorted by t
    const sorted = [...items].sort((a, b) => (a.t ?? 0) - (b.t ?? 0));

    schedulesRef.current.set(id, {
      baseMs: 0,       // reserved for future "insert at current time"
      cursor: 0,
      items: sorted,
    });

    // Store schedule metadata
    scheduleMetaRef.current.set(id, {
      kind: kind || "unknown",
      owner: owner || null,
      locks: locks || [],
    });
  }, [replaceMode, onCancelSchedule]);

  const dfocusatch = useCallback((evt) => {
    if (!evt) return;
    onEvent?.(evt);

    // history (for stepping/back)
    if (DEBUG_CLOCK) {
      historyRef.current.push({ atMs: playheadRef.current, event: evt });
      if (historyRef.current.length > maxHistory) {
        historyRef.current.splice(0, historyRef.current.length - maxHistory);
      }
    }
  }, [onEvent]);

  const dfocusatchRef = useRef(dfocusatch);
  useEffect(() => {
    dfocusatchRef.current = dfocusatch;
  }, [dfocusatch]);

  const engineCallRef = useRef(engineCall ?? defaultEngineCall);
  useEffect(() => {
    engineCallRef.current = engineCall ?? defaultEngineCall;
  }, [engineCall]);

  const tick = useCallback((realNow) => {
    if (isPaused) {
      lastRealRef.current = realNow;
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const last = lastRealRef.current ?? realNow;
    const deltaReal = realNow - last;
    lastRealRef.current = realNow;

    // advance playhead
    const s = Math.max(0, speed);
    playheadRef.current += deltaReal * s;

    // fire due events across all schedules
    for (const [id, sched] of schedulesRef.current.entries()) {
      const { items } = sched;
      let { cursor } = sched;

      while (cursor < items.length) {
        const item = items[cursor];
        const t = (item?.t ?? 0) + (sched.baseMs ?? 0);
        if (t > playheadRef.current) break;

        // Block later items until ENGINE_CALL resolves
        if (sched.engineCallInFlight) break;

        const ev = item.e;

        if (isEngineCallEvent(ev)) {
          const { method, payload } = ev;
          sched.engineCallInFlight = true;

          const castId = payload?.meta?.castId ?? "none";
          const caster = payload?.caster ?? "?";
          const target = typeof payload?.target === "string" ? payload.target : payload?.target?.id ?? "?";
          dfocusatchRef.current?.({
            type: "LOG",
            level: "info",
            message: `ðŸ§ª ENGINE_CALL ${method} castId=${castId} caster=${caster} target=${target}`,
          });

          engineCallRef.current(method, payload)
            .then((res) => {
              const out = res?.events ?? [];
              const types = out.map((x) => x?.type).filter(Boolean);
              dfocusatchRef.current?.({
                type: "LOG",
                level: "info",
                message: `ðŸ§ª ENGINE_CALL ${method} returned ${types.length} events: ${types.join(", ") || "(none)"}`,
              });
              for (const e of out) dfocusatchRef.current?.(e);
            })
            .catch((err) => {
              dfocusatchRef.current?.({
                type: "LOG",
                level: "error",
                message: `ENGINE_CALL ${method} failed: ${err?.message ?? String(err)}`,
              });
            })
            .finally(() => {
              const s2 = schedulesRef.current.get(id);
              if (s2) s2.engineCallInFlight = false;
              sched.cursor = cursor + 1;
            });

          break; // Stop processing this schedule until ENGINE_CALL resolves
        }

        dfocusatch(ev);
        cursor++;
      }

      sched.cursor = cursor;

      // if done, remove schedule and notify completion
      if (sched.cursor >= items.length) {
        schedulesRef.current.delete(id);
        scheduleMetaRef.current.delete(id);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [dfocusatch, isPaused, speed]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [tick]);

  // Debugging controls
  const stepForward = useCallback((ms = 16) => {
    playheadRef.current += ms;
    for (const [id, sched] of schedulesRef.current.entries()) {
      const { items } = sched;
      let { cursor } = sched;

      while (cursor < items.length) {
        const item = items[cursor];
        const t = (item?.t ?? 0) + (sched.baseMs ?? 0);
        if (t > playheadRef.current) break;
        if (sched.engineCallInFlight) break;

        const ev = item.e;
        if (isEngineCallEvent(ev)) {
          const { method } = ev;
          sched.engineCallInFlight = true;
          engineCallRef.current(ev.method, ev.payload)
            .then((res) => {
              const out = res?.events ?? [];
              for (const e of out) dfocusatchRef.current?.(e);
            })
            .catch((err) => {
              dfocusatchRef.current?.({
                type: "LOG",
                level: "error",
                message: `ENGINE_CALL ${method} failed: ${err?.message ?? String(err)}`,
              });
            })
            .finally(() => {
              const s2 = schedulesRef.current.get(id);
              if (s2) {
                s2.engineCallInFlight = false;
                s2.cursor = cursor + 1;
              }
            });
          break;
        }
        dfocusatch(ev);
        cursor++;
      }

      sched.cursor = cursor;
      if (sched.cursor >= items.length) {
        schedulesRef.current.delete(id);
        scheduleMetaRef.current.delete(id);
      }
    }
  }, [dfocusatch]);

  const stepBack = useCallback((ms = 120) => {
    // NOTE: stepping back requires state rewind support to be perfect.
    // Here we only move the playhead back; you'd also need to reapply state from a snapshot.
    playheadRef.current = Math.max(0, playheadRef.current - ms);
  }, []);

  return {
    // feed schedules
    addSchedule,

    // playback controls
    isPaused,
    setIsPaused,
    speed,
    setSpeed,

    // timeline ops
    clearAll,
    cancelSchedule,
    cancelByPrefix,
    cancelByKind,
    cancelByOwner,

    // debug
    stepForward,
    stepBack,

    // optional readouts
    getPlayheadMs: () => playheadRef.current,
    getHistory: () => historyRef.current.slice(),
  };
}

