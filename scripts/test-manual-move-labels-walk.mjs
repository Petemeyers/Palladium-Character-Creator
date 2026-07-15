import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");
const catalog = fs.readFileSync("src/utils/combatActionCatalog.js", "utf8");

assert.match(catalog, /id: "move"[\s\S]*name: "Walk"[\s\S]*type: "move"/);
assert.match(page, /let moveLabel = "Walk"/);
assert.match(page, /moveLabel = "Fly"/);
assert.match(page, /moveLabel = "Float"/);
assert.match(page, /Select a highlighted hex for \$\{currentFighter\.name\} to walk/);
assert.match(page, /Click &quot;\{canFlyNow \? \(playerMovementMode === "flight" \? "Fly" : "Walk"\) : "Walk"\}&quot;/);
assert.match(page, /Walking"\} mode active - select destination hex/);
assert.doesNotMatch(page, /Click &quot;Move&quot; button to activate movement mode/);
assert.doesNotMatch(page, /Click "Move" in Combat Options/);
assert.doesNotMatch(page, /moveLabel = "Move/);
assert.doesNotMatch(catalog, /id: "move"[\s\S]{0,120}name: "Move"/);

console.log("manual movement labels use Walk tests passed");
