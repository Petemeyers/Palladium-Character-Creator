import fs from "node:fs";
import assert from "node:assert/strict";

const read = (file) => fs.readFileSync(file, "utf8");
const page = read("src/pages/MapMakerPage.jsx");
const tactical = read("src/components/TacticalMap.jsx");
const sidebar = read("src/components/maps/MapMakerToolSidebar.jsx");
const interaction = read("src/utils/maps/mapEditorInteractionAuthority.js");

assert.ok(page.includes("editorFlattenHeight"), "MapMakerPage needs flatten target state.");
assert.ok(page.includes('"height-flatten"'), "MapMakerPage needs 3D flatten mode.");
assert.ok(page.includes("selectedHexHeight={selectedHexHeight}"), "Sidebar needs selected height reference.");
assert.ok(sidebar.includes("Flatten"), "Height sidebar needs Flatten control.");
assert.ok(sidebar.includes("Flatten to height"), "Height sidebar needs exact target input.");
assert.ok(sidebar.includes("Use Selected"), "Height sidebar needs selected-height shortcut.");
assert.ok(tactical.includes('editorBrushMode === "flatten"'), "2D map needs flatten painting.");
assert.ok(tactical.includes("editorFlattenHeight"), "2D map needs flatten target.");
assert.ok(tactical.includes("badgeX"), "Elevation value should use a corner badge.");
assert.ok(tactical.includes('fontSize="8"'), "Elevation badge should remain compact.");
assert.ok(interaction.includes('["raise", "lower", "flatten"]'), "Interaction authority needs flatten.");
assert.ok(interaction.includes('"height-flatten"'), "Interaction authority needs 3D flatten.");

console.log("PASS Map Maker flatten brush and compact elevation badge source contract");
