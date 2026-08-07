import assert from "node:assert/strict";
import fs from "node:fs";

const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const tacticalMap = fs.readFileSync(new URL("../src/components/TacticalMap.jsx", import.meta.url), "utf8");

assert.match(
  tacticalMap,
  /addEventListener\("wheel", handleNativeMapWheel, \{ passive: false \}\)/,
  "2D map must install a non-passive native wheel listener",
);
assert.match(tacticalMap, /event\.preventDefault\(\);\s*event\.stopPropagation\(\);/s);
assert.match(tacticalMap, /overscrollBehavior: 'contain'/);
assert.doesNotMatch(tacticalMap, /onWheel=\{handleMapWheel\}/);

const commitBlock = combatPage.slice(
  combatPage.indexOf("commitPosition: ({ actorId, from, to, movementMode, pulseIndex, stepPass })"),
  combatPage.indexOf("readPositionAuthorities:", combatPage.indexOf("commitPosition: ({ actorId, from, to, movementMode, pulseIndex, stepPass })")),
);
assert.match(commitBlock, /activeRuntime !== runtime/);
assert.match(commitBlock, /runtime\.combatSession !== combatSessionRef\.current/);
assert.doesNotMatch(commitBlock, /endTurnGenerationRef\.current/);

assert.match(
  combatPage,
  /if \(combatTimingModeRef\.current === COMBAT_TIMING_MODES\.TACTICAL_PULSE\) \{\s*return;\s*\}/s,
  "legacy initiative effect must not run while tactical pulse owns combat",
);
assert.match(combatPage, /\{DEBUG_COMBAT && \([\s\S]*?Step One Second/);
assert.match(combatPage, /\{\(!aiControlEnabled \|\| DEBUG_COMBAT\) && \(\(\) => \{/);
assert.match(combatPage, /\? "AI Auto"\s*:\s*"AI Paused"/s);

console.log("tactical auto UI and wheel regression: passed");
