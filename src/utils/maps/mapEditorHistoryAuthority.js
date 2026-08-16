const DEFAULT_HISTORY_LIMIT = 80;

function cloneValue(value) {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // JSON fallback below keeps map editor state serializable.
    }
  }
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function snapshotSignature(snapshot) {
  return JSON.stringify({
    mapDefinition: snapshot?.mapDefinition || null,
    mapProps: snapshot?.mapProps || [],
  });
}

export function createMapEditorSnapshot({
  mapDefinition,
  mapProps,
  selectedHex = null,
  selectedPropId = null,
  label = "edit",
} = {}) {
  const snapshot = {
    mapDefinition: cloneValue(mapDefinition || null),
    mapProps: cloneValue(Array.isArray(mapProps) ? mapProps : []),
    selectedHex: cloneValue(selectedHex || null),
    selectedPropId: selectedPropId == null ? null : String(selectedPropId),
    label: String(label || "edit"),
    capturedAt: Date.now(),
  };
  snapshot.signature = snapshotSignature(snapshot);
  return snapshot;
}

export function createMapEditorHistory({ limit = DEFAULT_HISTORY_LIMIT } = {}) {
  return {
    limit: Math.max(10, Math.min(250, Number(limit) || DEFAULT_HISTORY_LIMIT)),
    past: [],
    future: [],
  };
}

export function checkpointMapEditorHistory(history, snapshot) {
  if (!history || !snapshot) return false;
  const previous = history.past[history.past.length - 1];
  if (previous?.signature === snapshot.signature) return false;
  history.past.push(snapshot);
  if (history.past.length > history.limit) {
    history.past.splice(0, history.past.length - history.limit);
  }
  history.future = [];
  return true;
}

export function undoMapEditorHistory(history, currentSnapshot) {
  if (!history?.past?.length || !currentSnapshot) {
    return { accepted: false, snapshot: null, label: null };
  }
  const previous = history.past.pop();
  history.future.push(currentSnapshot);
  return {
    accepted: true,
    snapshot: cloneValue(previous),
    label: previous.label || "edit",
  };
}

export function redoMapEditorHistory(history, currentSnapshot) {
  if (!history?.future?.length || !currentSnapshot) {
    return { accepted: false, snapshot: null, label: null };
  }
  const next = history.future.pop();
  history.past.push(currentSnapshot);
  if (history.past.length > history.limit) {
    history.past.splice(0, history.past.length - history.limit);
  }
  return {
    accepted: true,
    snapshot: cloneValue(next),
    label: next.label || "edit",
  };
}

export function resetMapEditorHistory(history) {
  if (!history) return;
  history.past = [];
  history.future = [];
}

export function getMapEditorHistoryState(history) {
  return {
    canUndo: Boolean(history?.past?.length),
    canRedo: Boolean(history?.future?.length),
    undoDepth: history?.past?.length || 0,
    redoDepth: history?.future?.length || 0,
    nextUndoLabel: history?.past?.[history.past.length - 1]?.label || null,
    nextRedoLabel: history?.future?.[history.future.length - 1]?.label || null,
  };
}

export default {
  checkpointMapEditorHistory,
  createMapEditorHistory,
  createMapEditorSnapshot,
  getMapEditorHistoryState,
  redoMapEditorHistory,
  resetMapEditorHistory,
  undoMapEditorHistory,
};
