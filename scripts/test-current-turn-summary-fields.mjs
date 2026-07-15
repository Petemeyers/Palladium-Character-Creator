import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/components/CombatTurnStatusPanel.jsx", "utf8");

assert.match(source, /const formatActorHp = \(actor = \{\}\) =>/);
assert.match(source, /const formatActorStamina = \(actor = \{\}\) =>/);
assert.match(source, /const formatMovementMode = \(actor = \{\}\) =>/);
assert.match(source, />HP \/ State<\/Text>/);
assert.match(source, />Stamina<\/Text>/);
assert.match(source, />Movement<\/Text>/);
assert.match(source, />Actions<\/Text>/);
assert.match(source, />Posture<\/Text>/);
assert.match(source, />Next Step<\/Text>/);
assert.match(source, /showEndTurnButton/);
assert.match(source, /status\.endTurnButtonLabel/);

console.log("current turn summary field tests passed");
