import fs from "node:fs";
import assert from "node:assert/strict";

const traversal = fs.readFileSync(
  "src/utils/maps/battlefieldTraversalAuthority.js",
  "utf8"
);
const page = fs.readFileSync(
  "src/pages/MapMakerPage.jsx",
  "utf8"
);
const sidebar = fs.readFileSync(
  "src/components/maps/MapMakerToolSidebar.jsx",
  "utf8"
);
const tactical = fs.readFileSync(
  "src/components/TacticalMap.jsx",
  "utf8"
);
const water = fs.readFileSync(
  "src/utils/maps/waterTraversalAuthority.js",
  "utf8"
);

const checks = [
  ["water traversal integrated", traversal.includes("resolveBattlefieldWaterTraversalStep({")],
  ["swim authorization input", traversal.includes("swimAuthorized = false")],
  ["actor water profile input", traversal.includes("waterProfile = null")],
  ["water stamina combined", traversal.includes("waterTraversal?.staminaCost")],
  ["water distance combined", traversal.includes("waterExtraDistanceFeet")],
  ["water failure wording", traversal.includes("describeWaterTraversalFailure(reason)")],

  ["actor-height depth bands", water.includes("swimThresholdFraction") && water.includes("heightFeet")],
  ["depth/wading profiles", water.includes("WATER_DEPTH_MOVEMENT_PROFILES")],
  ["current profiles", water.includes("WATER_CURRENT_PROFILES")],
  ["bottom traction", water.includes("BOTTOM_PROFILES")],
  ["equipment burden hook", water.includes("armorWaterBurden") && water.includes("carriedLoadFraction")],
  ["current drift hook", water.includes("projectWaterCurrentDrift")],
  ["AI water-risk hook", water.includes("assessWaterTraversalRisk") && water.includes('"severe"')],
  ["safety line hook", water.includes("holdingSafetyLine")],
  ["immersion hook for 8D2", water.includes("immersionFraction")],
  ["water temperature authored", water.includes("temperatureF")],
  ["bridge/lower surface authority", water.includes("getBridgeDeckLayersAt") && water.includes("getWaterTraversalSurfacesAt")],
  ["vertical layer transition hook", water.includes("resolveWaterLayerTransition")],

  ["Map Maker water config", page.includes("waterPaintConfig")],
  ["selected water edit", page.includes("applySelectedWaterEnvironment")],
  ["3D water brush defaults", page.includes("applyWaterEnvironmentToCell")],
  ["sidebar water panel", sidebar.includes("Water Environment")],
  ["sidebar depth", sidebar.includes("Depth (ft)")],
  ["sidebar current", sidebar.includes("waterCurrentStrength")],
  ["sidebar bottom", sidebar.includes("waterBottomTerrain")],
  ["sidebar temperature", sidebar.includes("Water temp (F)")],
  ["2D water brush metadata", tactical.includes("applyWaterEnvironmentToCell")],
  ["water editor labels", tactical.includes("water-editor-label-")],
];

let failures = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failures += 1;
}

if (failures) process.exit(1);
console.log("PASS Milestone 8C-8D1 installed-source contract");
