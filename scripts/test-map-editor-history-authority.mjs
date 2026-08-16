import assert from "node:assert/strict";
import {
  checkpointMapEditorHistory,
  createMapEditorHistory,
  createMapEditorSnapshot,
  getMapEditorHistoryState,
  redoMapEditorHistory,
  undoMapEditorHistory,
} from "../src/utils/maps/mapEditorHistoryAuthority.js";

const history = createMapEditorHistory({ limit: 10 });
const snapshot = (height, props = [], label = `height ${height}`) =>
  createMapEditorSnapshot({
    mapDefinition: { grid: [[{ height, elevation: height }]] },
    mapProps: props,
    selectedHex: { q: 0, r: 0 },
    label,
  });

const s0 = snapshot(0);
assert.equal(checkpointMapEditorHistory(history, s0), true);
assert.equal(checkpointMapEditorHistory(history, snapshot(0)), false, "duplicate state should coalesce");

const current1 = snapshot(1);
const undo1 = undoMapEditorHistory(history, current1);
assert.equal(undo1.accepted, true);
assert.equal(undo1.snapshot.mapDefinition.grid[0][0].height, 0);
assert.equal(getMapEditorHistoryState(history).canRedo, true);

const redo1 = redoMapEditorHistory(history, undo1.snapshot);
assert.equal(redo1.accepted, true);
assert.equal(redo1.snapshot.mapDefinition.grid[0][0].height, 1);

for (let value = 1; value <= 14; value += 1) {
  checkpointMapEditorHistory(history, snapshot(value));
}
assert.equal(history.past.length, 10, "history should respect configured ring limit");

const propState = snapshot(4, [{ id: "barrel-1", type: "barrel" }], "place prop");
checkpointMapEditorHistory(history, propState);
const deleted = snapshot(4, [], "current");
const undoDelete = undoMapEditorHistory(history, deleted);
assert.equal(undoDelete.snapshot.mapProps.length, 1);
assert.equal(undoDelete.snapshot.mapProps[0].id, "barrel-1");

console.log("PASS map editor undo/redo snapshot authority");
