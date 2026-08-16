import assert from "node:assert/strict";
import {
  applyOrthogonalStructureWallDrag,
  buildOrthogonalStructureRoute,
  cellToOrthogonalStructurePoint,
  getCellOrthogonalStructureSegments,
  getOrthogonalStructureJunctions,
  getOrthogonalStructureSegments,
  getOrthogonalStructureSegmentsFromGrid,
  normalizeOrthogonalStructureSegment,
  orthogonalStructureSegmentToOwnerSvgLine,
  removeOrthogonalStructureRun,
  removeOrthogonalStructureRunsOwnedByCell,
  setOrthogonalStructureRunOpen,
} from "../src/utils/maps/orthogonalStructureAuthority.js";
import { buildOrthogonalHexStructurePreview } from "../src/utils/maps/orthogonalStructureGenerator.js";

const makeGrid = (width = 12, height = 10) =>
  Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => ({
      x,
      y,
      q: x,
      r: y,
      terrain: "grass",
      terrainType: "grass",
      height: 0,
      elevation: 0,
    }))
  );

{
  const route = buildOrthogonalStructureRoute({
    start: { x: 1, z: 2 },
    end: { x: 6, z: 5 },
    cornerMode: "horizontal-first",
  });
  assert.equal(route.accepted, true);
  assert.equal(route.segments.length, 2);
  assert.deepEqual(route.points, [{ x: 1, z: 2 }, { x: 6, z: 2 }, { x: 6, z: 5 }]);
  for (const segment of route.segments) {
    assert.ok(segment.a.x === segment.b.x || segment.a.z === segment.b.z, "canonical segment must be axis aligned");
  }
}

{
  const route = buildOrthogonalStructureRoute({
    start: { x: 1, z: 2 },
    end: { x: 6, z: 5 },
    cornerMode: "vertical-first",
  });
  assert.deepEqual(route.points, [{ x: 1, z: 2 }, { x: 1, z: 5 }, { x: 6, z: 5 }]);
}

{
  const route = buildOrthogonalStructureRoute({ start: { x: 1, z: 2 }, end: { x: 6, z: 2 } });
  assert.equal(route.segments.length, 1);
  assert.equal(route.segments[0].orientation, "horizontal");
}

{
  const forced = normalizeOrthogonalStructureSegment({ a: { x: 1, z: 1 }, b: { x: 7, z: 4 }, kind: "wall" });
  assert.ok(forced.a.x === forced.b.x || forced.a.z === forced.b.z);
}

{
  const a = cellToOrthogonalStructurePoint({ x: 1, y: 2 }, "hex", 1);
  const b = cellToOrthogonalStructurePoint({ x: 4, y: 5 }, "hex", 1);
  assert.ok(Number.isFinite(a.x) && Number.isFinite(a.z));
  assert.ok(Number.isFinite(b.x) && Number.isFinite(b.z));
  const preview = buildOrthogonalHexStructurePreview({ startCell: { x: 1, y: 2 }, endCell: { x: 4, y: 5 } });
  assert.equal(preview.accepted, true);
  assert.ok(preview.segments.length === 1 || preview.segments.length === 4);
  preview.segments.forEach((segment) => assert.ok(segment.orientation === "horizontal" || segment.orientation === "vertical"));
}

{
  const originalStructures = {
    version: 1,
    bridges: [{ id: "bridge-1", path: [{ x: 1, y: 1 }, { x: 2, y: 1 }] }],
  };
  const result = applyOrthogonalStructureWallDrag({
    grid: makeGrid(),
    structures: originalStructures,
    mapType: "hex",
    startCell: { x: 1, y: 2 },
    endCell: { x: 6, y: 4 },
    edge: { kind: "wall", material: "stone", heightFeet: 12 },
    cornerMode: "horizontal-first",
  });
  assert.equal(result.accepted, true);
  assert.ok(result.segments.length >= 1 && result.segments.length <= 2);
  assert.equal(result.structures.bridges.length, 1, "bridge data must be preserved");
  assert.equal(getOrthogonalStructureSegments(result.structures).length, result.segments.length);
  const ownerSegments = getCellOrthogonalStructureSegments(result.grid[2][1]);
  assert.equal(ownerSegments.length, result.segments.length);
  assert.ok(ownerSegments.every((segment) => segment.ownerCell.x === 1 && segment.ownerCell.y === 2));
  assert.ok(ownerSegments.every((segment) => segment.blocksMovement === true));
  assert.ok(ownerSegments.every((segment) => segment.blocksLineOfSight === true));

  const junctions = getOrthogonalStructureJunctions(ownerSegments);
  if (ownerSegments.length === 2) {
    assert.equal(junctions.filter((entry) => entry.type === "corner").length, 1);
  }

  const removed = removeOrthogonalStructureRun({
    grid: result.grid,
    structures: result.structures,
    runId: result.runId,
  });
  assert.equal(removed.accepted, true);
  assert.equal(getOrthogonalStructureSegments(removed.structures).length, 0);
  assert.equal(getCellOrthogonalStructureSegments(removed.grid[2][1]).length, 0);
}

{
  const result = applyOrthogonalStructureWallDrag({
    grid: makeGrid(),
    structures: {},
    mapType: "hex",
    startCell: { x: 2, y: 2 },
    endCell: { x: 5, y: 2 },
    edge: { kind: "gate", material: "wood", open: false },
  });
  assert.equal(result.accepted, true);
  assert.ok(result.segments.every((segment) => segment.blocksMovement === true));
  const opened = setOrthogonalStructureRunOpen({
    grid: result.grid,
    structures: result.structures,
    runId: result.runId,
    open: true,
  });
  assert.equal(opened.accepted, true);
  assert.ok(getOrthogonalStructureSegments(opened.structures).every((segment) => segment.open === true));
  assert.ok(getOrthogonalStructureSegments(opened.structures).every((segment) => segment.blocksMovement === false));
}

{
  const result = applyOrthogonalStructureWallDrag({
    grid: makeGrid(),
    structures: {},
    mapType: "hex",
    startCell: { x: 1, y: 1 },
    endCell: { x: 5, y: 3 },
    edge: { kind: "wall", material: "stone" },
  });
  const owner = { x: 1, y: 1 };
  for (const segment of result.segments) {
    const line = orthogonalStructureSegmentToOwnerSvgLine({
      segment,
      ownerCell: owner,
      mapType: "hex",
      ownerCenterX: 100,
      ownerCenterY: 100,
      hexSize: 20,
    });
    assert.ok(line);
    assert.ok(Math.abs(line.x1 - line.x2) < 1e-8 || Math.abs(line.y1 - line.y2) < 1e-8, "SVG wall must be horizontal or vertical");
  }
}


{
  const placed = applyOrthogonalStructureWallDrag({
    grid: makeGrid(), structures: {}, mapType: "hex",
    startCell: { x: 3, y: 3 }, endCell: { x: 7, y: 5 },
    edge: { kind: "wall" },
  });
  const removed = removeOrthogonalStructureRunsOwnedByCell({
    grid: placed.grid, structures: placed.structures, x: 3, y: 3,
  });
  assert.equal(removed.accepted, true);
  assert.equal(getCellOrthogonalStructureSegments(removed.grid[3][3]).length, 0);
  assert.equal(getOrthogonalStructureSegments(removed.structures).length, 0);
}


{
  const placed = applyOrthogonalStructureWallDrag({
    grid: makeGrid(), structures: {}, mapType: "hex",
    startCell: { x: 1, y: 2 }, endCell: { x: 4, y: 4 },
    edge: { kind: "wall" }, step: 0.5,
  });
  assert.equal(placed.accepted, true);
  assert.equal(placed.structures.orthogonal.latticeStep, 0.5);
  assert.ok(getOrthogonalStructureSegments(placed.structures).every((segment) => segment.latticeStep === 0.5));
  assert.ok(getCellOrthogonalStructureSegments(placed.grid[2][1]).every((segment) => segment.latticeStep === 0.5));
}


{
  // TacticalMap uses flat-top odd-r offset coordinates. Row 2 has no half-column
  // X shift; row 3 does. This prevents the axial-style cumulative row drift.
  const evenRow = cellToOrthogonalStructurePoint({ x: 4, y: 2 }, "hex", 0.0001);
  const oddRow = cellToOrthogonalStructurePoint({ x: 4, y: 3 }, "hex", 0.0001);
  assert.ok(Math.abs(evenRow.x - Math.sqrt(3) * 4) < 0.001);
  assert.ok(Math.abs(oddRow.x - Math.sqrt(3) * 4.5) < 0.001);
}

{
  // 8C-8C.1 persists cell edits even on repos that do not yet have generic
  // top-level result.structures plumbing. Orthogonal runs must remain operable
  // from their owner-cell cache in that configuration.
  const placed = applyOrthogonalStructureWallDrag({
    grid: makeGrid(), structures: {}, mapType: "hex",
    startCell: { x: 2, y: 2 }, endCell: { x: 6, y: 4 },
    edge: { kind: "wall", material: "stone" },
  });
  assert.equal(placed.accepted, true);
  const gridOnlySegments = getOrthogonalStructureSegmentsFromGrid(placed.grid);
  assert.equal(gridOnlySegments.length, placed.segments.length);
  const removed = removeOrthogonalStructureRun({
    grid: placed.grid, structures: {}, runId: placed.runId,
  });
  assert.equal(removed.accepted, true);
  assert.equal(getOrthogonalStructureSegmentsFromGrid(removed.grid).length, 0);
}

console.log("PASS orthogonal structure authority, legacy corner routing, and R5 wall-box preview");
