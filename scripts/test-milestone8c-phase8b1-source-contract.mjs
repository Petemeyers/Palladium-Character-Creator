import fs from "node:fs";
import assert from "node:assert/strict";

const page = fs.readFileSync("src/pages/MapMakerPage.jsx", "utf8");
const sidebar = fs.readFileSync("src/components/maps/MapMakerToolSidebar.jsx", "utf8");
const tactical = fs.readFileSync("src/components/TacticalMap.jsx", "utf8");
const arena = fs.readFileSync("src/utils/three/HexArena.js", "utf8");
const mapBuilder = fs.readFileSync("src/utils/three/mapBuilder3D.js", "utf8");
const propCatalog = fs.readFileSync("src/utils/maps/battlefieldPropCatalog.js", "utf8");
const renderer = fs.readFileSync("src/utils/three/squareStructure3D.js", "utf8");
const generator = fs.readFileSync("src/utils/maps/squareStructureGenerator.js", "utf8");
const authority = fs.readFileSync("src/utils/maps/squareStructureAuthority.js", "utf8");

const checks = [
  ["room drag authority", generator.includes("applySquareStructureRoom")],
  ["wall line authority", generator.includes("applySquareStructureWallLine")],
  ["building generator", generator.includes("generateSquareBuilding")],
  ["tavern template", generator.includes('TAVERN: "tavern"')],
  ["building prop sockets", generator.includes("propSuggestions")],
  ["historical window choices", authority.includes('SHUTTERED: "shuttered"') && authority.includes('LEADED: "leaded"') && generator.includes("SQUARE_WINDOW_STYLES.SHUTTERED") && generator.includes("SQUARE_WINDOW_STYLES.LEADED")],
  ["MapMaker generator state", page.includes("structureGeneratorConfig")],
  ["MapMaker drag completion", page.includes("handleSquareStructureDragEnd")],
  ["TacticalMap drag start/end", tactical.includes("structureDragRef") && tactical.includes("finishStructureDrag")],
  ["TacticalMap drag preview", tactical.includes("structure-drag-preview-")],
  ["fast structure UI", sidebar.includes("Fast Structure Authoring")],
  ["building seed UI", sidebar.includes("Generation seed")],
  ["GLB/Tripo URL UI", sidebar.includes("GLB / Tripo asset URL")],
  ["curved arch UI", sidebar.includes("Curved Archway")],
  ["proper curved arch geometry", renderer.includes("createArchWallGeometry") && renderer.includes("properCurvedArch: true")],
  ["GLTF structure loader", renderer.includes("GLTFLoader") && renderer.includes("attachAssetIfAvailable")],
  ["procedural asset fallback", renderer.includes("procedural-structure-fallback")],
  ["window leading", renderer.includes("window-leading")],
  ["shutter visual", renderer.includes("window-shutter")],
  ["expanded prop catalog", propCatalog.includes("EXPANDED_BATTLEFIELD_PROP_DEFINITIONS")],
  ["prop gameplay data", propCatalog.includes("getPropGameplayProfile")],
  ["richer prop fallback", arena.includes("createBattlefieldPropFallbackMesh")],
  ["apple tree scaling", arena.includes('["tree", "apple-tree"].includes(prop?.type)')],
  ["slimmer terrain trees", mapBuilder.includes("new THREE.CylinderGeometry(0.07, 0.10, 3.4, 8)")],
];

let failures = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failures += 1;
}
if (failures) process.exit(1);

console.log("PASS Milestone 8C-8B.1 installed-source contract");
