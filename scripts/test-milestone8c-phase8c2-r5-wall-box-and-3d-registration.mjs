#!/usr/bin/env node
import fs from "node:fs";
import {
  applyOrthogonalStructureBoxDrag,
  buildOrthogonalStructureBoxRoute,
} from "../src/utils/maps/orthogonalStructureAuthority.js";
import { buildOrthogonalHexStructurePreview } from "../src/utils/maps/orthogonalStructureGenerator.js";

const pass = (label, ok) => {
  if (!ok) {
    console.error(`FAIL ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS ${label}`);
  }
};

const box = buildOrthogonalStructureBoxRoute({
  start: { x: 2, z: 3 },
  end: { x: 8, z: 9 },
  step: 1,
});
pass("diagonal drag creates closed box", box.accepted && box.closed === true && box.segments.length === 4);
pass("box segments remain axis-aligned", box.segments.every((s) => s.orientation === "horizontal" || s.orientation === "vertical"));
pass("box route closes on start point", box.points.length === 5 && box.points[0].x === box.points[4].x && box.points[0].z === box.points[4].z);

const line = buildOrthogonalStructureBoxRoute({
  start: { x: 2, z: 3 },
  end: { x: 8, z: 3 },
  step: 1,
});
pass("aligned drag remains one straight wall", line.accepted && line.closed === false && line.segments.length === 1);

const grid = Array.from({ length: 6 }, (_, y) =>
  Array.from({ length: 8 }, (_, x) => ({ x, y }))
);
const applied = applyOrthogonalStructureBoxDrag({
  grid,
  structures: {},
  mapType: "hex",
  startCell: { x: 1, y: 1 },
  endCell: { x: 5, y: 4 },
  edge: { kind: "wall", material: "stone", heightFeet: 10 },
  step: 1,
});
pass("box drag writes one canonical run", applied.accepted && applied.closed === true && applied.segments.length === 4 && !!applied.runId);
pass("box drag caches run on owner cell", Array.isArray(applied.grid?.[1]?.[1]?.orthogonalStructureSegments) && applied.grid[1][1].orthogonalStructureSegments.length === 4);
pass("box drag writes top-level structure segments", Array.isArray(applied.structures?.orthogonalSegments) && applied.structures.orthogonalSegments.length === 4);

const preview = buildOrthogonalHexStructurePreview({
  startCell: { x: 2, y: 2 },
  endCell: { x: 6, y: 5 },
  step: 1,
});
pass("2D hex preview uses same four-side box route", preview.accepted && preview.closed === true && preview.segments.length === 4);

const sidebar = fs.readFileSync("src/components/maps/MapMakerToolSidebar.jsx", "utf8");
const renderer = fs.readFileSync("src/utils/three/orthogonalStructure3D.js", "utf8");
const generator = fs.readFileSync("src/utils/maps/orthogonalStructureGenerator.js", "utf8");

pass("sidebar labels single-drag wall box", sidebar.includes("Orthogonal Wall / Box"));
pass("old two-angle selector removed from visible sidebar", !sidebar.includes("90° corner routing"));
pass("sidebar explains drag-and-release box gesture", sidebar.includes("Single drag and release"));
pass("generator uses box drag authority", generator.includes("applyOrthogonalStructureBoxDrag"));
pass("3D renderer registers actual terrain anchors", renderer.includes("registerCalibrationAnchor") && renderer.includes("cellToCanonicalMapPoint"));
pass("3D renderer solves map basis from terrain", renderer.includes("deriveRegisteredMapBasis") && renderer.includes("sourceKeys"));
pass("3D projection consumes solved X/Z basis", renderer.includes("delta.x * mapBasis.xAxis.x") && renderer.includes("delta.z * mapBasis.zAxis.x"));
pass("fallback collections repair after calibration", renderer.includes("repair any wall collection rendered") && renderer.includes("state.entries.entries()"));

if (!process.exitCode) {
  console.log("PASS Milestone 8C-8C.2 R5 wall-box + registered 3D basis contract");
}
