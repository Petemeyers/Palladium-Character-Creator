import assert from "node:assert/strict";
import fs from "node:fs";

const layout = fs.readFileSync("src/utils/combatCommandLayout.js", "utf8");
const panel = fs.readFileSync("src/components/CompatibilityCombatControlsPanel.jsx", "utf8");

assert.match(layout, /primaryLabel: "Primary Manual Controls"/);
assert.match(layout, /compatibilityLabel: "Advanced Combat Tools"/);
assert.match(layout, /compatibilityToolsLabel: "Advanced Tools"/);
assert.match(layout, /Additional combat controls preserved for the current engine/);
assert.match(panel, /Selected action: \{currentActionName\}/);
assert.doesNotMatch(layout, /Fallback Testing/);
assert.doesNotMatch(layout, /Older controls preserved for fallback testing/);
assert.doesNotMatch(panel, /Legacy action:/);

console.log("manual controls player-facing label tests passed");
