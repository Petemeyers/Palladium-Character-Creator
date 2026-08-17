import fs from "node:fs";

const pagePath = "src/pages/MapMakerPage.jsx";
const builderPath = "src/utils/three/mapBuilder3D.js";

const page = fs.readFileSync(pagePath, "utf8");
const builder = fs.readFileSync(builderPath, "utf8");

const checks = [
  ["3D viewport is no longer conditionally mounted", !page.includes('{viewMode === "3d" && render3DViewport()}')],
  ["2D viewport is no longer conditionally mounted", !page.includes('{viewMode === "2d" && render2DViewport()}')],
  ["stable viewport layout authority present", page.includes("keep both viewports mounted")],
  ["3D viewport hides instead of unmounting", page.includes('display={viewMode === "2d" ? "none" : "block"}')],
  ["2D viewport hides instead of unmounting", page.includes('display={viewMode === "3d" ? "none" : "block"}')],
  ["split layout uses persistent viewport nodes", page.includes('templateColumns={viewMode === "split"')],
  ["canonical top-level structures preserved", page.includes('structures: result.structures ?? mapDefinition?.structures ?? {}')],
  ["orthogonal renderer waits for Three.js parent", builder.includes('mesh.addEventListener?.("added", renderOrthogonalStructuresAfterParenting)')],
  ["post-parent registration checks mesh.parent", builder.includes('if (!mesh.parent) return;')],
  ["initial orthogonal owner uses offset grid position", builder.includes('tile?.gridPosition || mesh.userData?.gridPosition || axialToOffset')],
  ["initial orthogonal registration passes col", builder.includes('x: Number.isFinite(col) ? col : 0')],
  ["initial orthogonal registration passes row", builder.includes('y: Number.isFinite(row) ? row : 0')],
  ["old initial axial q/r orthogonal call removed", !builder.includes('x: tile.q ?? 0,\n    y: tile.r ?? 0,\n  });\n  return mesh;')],
  ["incremental orthogonal update remains offset-based", builder.includes('x: col,\n    y: row,')],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (ok) console.log(`PASS ${name}`);
  else {
    console.error(`FAIL ${name}`);
    failed += 1;
  }
}

if (failed) {
  console.error(`FAIL Milestone 8C-8C.2 R5.2 source contract (${failed} failures)`);
  process.exit(1);
}
console.log("PASS Milestone 8C-8C.2 R5.2 stable view + parented structure registration");
