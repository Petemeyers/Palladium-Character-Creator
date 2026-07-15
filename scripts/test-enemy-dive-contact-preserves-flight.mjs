import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");

assert.match(source, /const diveLivePositions =[\s\S]*\? positionsRef\.current[\s\S]*: livePositions/);
assert.match(source, /const contactAlt = targetAlt \+ 5/);
assert.match(source, /attackerStatePatch: \{[\s\S]*altitudeFeet: contactAlt[\s\S]*altitude: contactAlt[\s\S]*isFlying: true/);
assert.match(source, /source: "enemy-dive-attack"/);
assert.match(source, /source: "DIVE_ATTACK"/);
assert.doesNotMatch(source, /attackerStatePatch: \{[\s\S]{0,180}altitudeFeet: targetAlt[\s\S]{0,120}isFlying: targetAlt > 0/);
assert.doesNotMatch(source, /const livePositions =[\s\S]{0,120}: livePositions;/);

console.log("enemy dive contact preserves flight tests passed");
