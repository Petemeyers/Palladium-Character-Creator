import assert from "node:assert/strict";
import fs from "node:fs";

const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const tacticalMap = fs.readFileSync(new URL("../src/components/TacticalMap.jsx", import.meta.url), "utf8");

assert.match(combatPage, /arenaChampionAuthority\.js/);
assert.match(combatPage, /normalizeArenaChampionActor\(newFighter/);
assert.match(combatPage, /post-schema-arena-champion-authority/);
assert.match(combatPage, /explicitNoArmorRequested/);
assert.match(combatPage, /requestedPrimaryWeaponName/);
assert.match(combatPage, /createCanonicalArmingSword/);

const dashMatches = tacticalMap.match(/data-morale-shock-dash=/g) || [];
assert.equal(dashMatches.length, 5, "Morale shock marker must use five compact dashes");
assert.match(tacticalMap, /Compact anime-style shock dashes above the token/);
assert.doesNotMatch(tacticalMap, /y2=\{burstY - 7\}/, "Old long center ray must be removed");
assert.doesNotMatch(tacticalMap, /iconX - 14/, "Old wide left ray must be removed");
assert.doesNotMatch(tacticalMap, /iconX \+ 14/, "Old wide right ray must be removed");

console.log("Arena Champion and morale-marker source contract passed.");
