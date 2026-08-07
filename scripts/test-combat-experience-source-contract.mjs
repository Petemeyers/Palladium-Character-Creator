import assert from "node:assert/strict";
import fs from "node:fs";

const combat = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const map = fs.readFileSync(new URL("../src/components/TacticalMap.jsx", import.meta.url), "utf8");

// Tactical Pulse remains available as a simulation/debug mode.
assert.match(combat, /runTacticalPulses\(6\)/);
assert.match(combat, /tacticalAutoPlaybackEnabled/);
assert.match(combat, /tactical-pulse-loading/);
assert.match(combat, /Planning actions/);
assert.match(combat, /getCanonicalMovementActionBudgetFt\(context\.actor, "walk"\)/);
assert.match(combat, /walk-action-completed/);
assert.match(combat, /presentationDelayMs: getTacticalPresentationDelayMs/);

// Initiative Actions is the player-facing default and alternates after one action.
assert.match(combat, /useState\(INITIATIVE_ACTIONS_MODE\)/);
assert.match(combat, /Initiative Actions \(Default\)/);
assert.match(combat, /initiative-action-pass-completed/);
assert.match(combat, /!initiativeActionsMode &&/);
assert.match(combat, /manual-initiative-action-move-finalized/);
assert.match(combat, /fullCommitmentMovement/);
assert.match(combat, /movementSpentThisRoundFt/);

// Tactical map interaction remains contained.
assert.match(map, /addEventListener\("wheel", handleNativeMapWheel, \{ passive: false \}\)/);
assert.doesNotMatch(map, /onWheel=\{handleMapWheel\}/);
assert.match(map, /tactical-map-processing-overlay/);
assert.match(map, /Wheel zoom · Shift-drag pan/);
assert.match(map, /fitMapToViewport/);
assert.match(map, /Math\.min\(2\.5, Math\.max\(0\.6, value\)\)/);

console.log("combat experience source contract: passed");
