#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  MAP_COORDINATE_AUTHORITY_ID,
  cellToCanonicalMapPoint,
  canonicalMapPointDelta,
  projectCanonicalMapSegmentToOwner2D,
} from "../src/utils/maps/mapCoordinateAuthority.js";

const approx = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const pass = (label, ok) => {
  if (!ok) {
    console.error(`FAIL ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS ${label}`);
  }
};

pass("canonical authority id", MAP_COORDINATE_AUTHORITY_ID === "canonical-map-coordinate-v1");

const even = cellToCanonicalMapPoint({ x: 4, y: 0 }, "hex");
pass("hex even-row center", approx(even.x, Math.sqrt(3) * 4) && approx(even.z, 0));

const odd = cellToCanonicalMapPoint({ x: 4, y: 1 }, "hex");
pass("hex odd-row half-column offset", approx(odd.x, Math.sqrt(3) * 4.5) && approx(odd.z, 1.5));

const square = cellToCanonicalMapPoint({ x: 4, y: 1 }, "square");
pass("square center mapping preserved", approx(square.x, 8) && approx(square.z, 2));

const d = canonicalMapPointDelta({ x: 10, z: 8 }, { x: 4, z: 3 });
pass("canonical point delta", approx(d.x, 6) && approx(d.z, 5));

const line = projectCanonicalMapSegmentToOwner2D({
  a: { x: 4, z: 3 },
  b: { x: 10, z: 3 },
  ownerPoint: { x: 4, z: 3 },
  ownerCenterX: 100,
  ownerCenterY: 70,
  unitsPerMapUnit: 12,
});
pass("2D projection is derived from canonical map delta", line.x1 === 100 && line.y1 === 70 && line.x2 === 172 && line.y2 === 70);

const root = process.cwd();
const authorityPath = path.join(root, "src/utils/maps/orthogonalStructureAuthority.js");
const rendererPath = path.join(root, "src/utils/three/orthogonalStructure3D.js");
const authority = fs.existsSync(authorityPath) ? fs.readFileSync(authorityPath, "utf8") : "";
const renderer = fs.existsSync(rendererPath) ? fs.readFileSync(rendererPath, "utf8") : "";

pass("orthogonal authority delegates cell mapping", authority.includes("cellToCanonicalMapPoint(cell, mapType)"));
pass("2D wall projection uses shared map projection", authority.includes("projectCanonicalMapSegmentToOwner2D"));
pass("3D wall renderer consumes canonical map deltas", renderer.includes("canonicalMapPointDelta(point, ownerPoint)"));
pass("3D owner anchor converted to map-parent frame", renderer.includes("structureParent.worldToLocal(world.clone())"));
pass("3D collection attaches by parent-local add", renderer.includes("structureParent.add(collection)"));
pass("R3 Object3D.attach path removed", !renderer.includes("structureParent.attach(collection)"));
pass("R3 raw world-axis reconstruction removed", !renderer.includes("ownerSurfaceWorld.x +"));
pass("3D segment length derives from projected endpoints", renderer.includes("Math.hypot(dx, dz)"));
pass("3D segment angle derives from projected endpoints", renderer.includes("Math.atan2(dz, dx)"));

if (!process.exitCode) console.log("PASS Milestone 8C-8C.2 R4 unified coordinate source contract");
