#!/usr/bin/env node
import fs from "node:fs";

const path = "src/components/TacticalMap.jsx";
if (!fs.existsSync(path)) {
  console.error("FAIL TacticalMap.jsx exists");
  process.exit(1);
}

const source = fs.readFileSync(path, "utf8");
const checks = [];
const check = (label, ok) => checks.push([label, Boolean(ok)]);

check(
  "TacticalMap defines rendered hex radius as half GRID_CONFIG.HEX_SIZE",
  /const\s+HEX_RADIUS\s*=\s*GRID_CONFIG\.HEX_SIZE\s*\/\s*2\s*;/.test(source)
);
check(
  "orthogonal 2D projection renderer present",
  source.includes("orthogonalStructureSegmentToOwnerSvgLine")
);

const callPattern = /orthogonalStructureSegmentToOwnerSvgLine\s*\(\s*\{[\s\S]*?\}\s*\)/g;
const calls = source.match(callPattern) || [];
check("orthogonal 2D projection calls found", calls.length > 0);
check(
  "all orthogonal 2D projection calls use HEX_RADIUS",
  calls.length > 0 && calls.every((call) => /hexSize\s*:\s*HEX_RADIUS\b/.test(call))
);
check(
  "no orthogonal 2D projection call uses full GRID_CONFIG.HEX_SIZE",
  calls.every((call) => !/hexSize\s*:\s*GRID_CONFIG\.HEX_SIZE\b/.test(call))
);
check(
  "canonical hex map authority remains radius-based",
  source.includes("const HEX_WIDTH = Math.sqrt(3) * HEX_RADIUS") &&
    source.includes("const HEX_VERTICAL_SPACING = (3 / 2) * HEX_RADIUS")
);

let failures = 0;
for (const [label, ok] of checks) {
  if (ok) console.log(`PASS ${label}`);
  else {
    console.log(`FAIL ${label}`);
    failures += 1;
  }
}

if (failures) {
  console.error(`FAIL Milestone 8C-8C.2 R5.3 source contract (${failures} failure${failures === 1 ? "" : "s"})`);
  process.exit(1);
}

console.log(`PASS Milestone 8C-8C.2 R5.3 2D radius-scale parity contract (${calls.length} projection call${calls.length === 1 ? "" : "s"})`);
