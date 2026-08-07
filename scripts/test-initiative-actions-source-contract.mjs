import assert from "node:assert/strict";
import fs from "node:fs";

const combat = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const movement = fs.readFileSync(new URL("../src/utils/combat/movementActionAuthority.js", import.meta.url), "utf8");

assert.match(combat, /useState\(INITIATIVE_ACTIONS_MODE\)/);
assert.match(combat, /Initiative Actions \(Default\)/);
assert.match(combat, /one action per fighter in initiative order/);
assert.match(combat, /createInitiativeTurnSlotKey\(\{/);
assert.match(combat, /turnCounter:\s*turnCounterRef\.current \?\? turnCounter/);
assert.doesNotMatch(combat, /keyParts\.push\(`pass-\$\{getInitiativeActionPassIndex\(fighter\)\}`\)/);
assert.match(combat, /canTakeInitiativeActionPass\(fighter, canFighterStartTurn\)/);
assert.match(combat, /!initiativeActionsMode &&/);
assert.match(combat, /initiative-action-pass-completed/);
assert.match(combat, /allowsSameActorActionContinuation\(combatTimingModeRef\.current\) &&\s*isCapableWithActions/);
assert.match(combat, /const canContinuePlayerAI =\s*allowsSameActorActionContinuation\(combatTimingModeRef\.current\)/);
assert.match(combat, /const canContinue =\s*allowsSameActorActionContinuation\(combatTimingModeRef\.current\)/);
assert.match(combat, /const authoritativePosition =\s*positionsRef\.current\?\.\[live\.id\]/);
assert.match(combat, /player AI movement destination clamped/);
assert.match(combat, /const committedPath = fullPath\.slice\(0, maximumSteps\)/);
assert.match(combat, /action: "WALK"/);
assert.match(combat, /movementSpentThisRoundFt/);
assert.match(combat, /advances at a controlled walk for this initiative action/);
assert.match(combat, /Initiative Actions keeps ordinary closing movement as a walk/);
assert.match(movement, /const remainingRoundFeet = Math\.max\(0, roundGroundPace - spentThisRound\)/);
assert.match(movement, /const strideFeet = Math\.max\(5, roundUpToHex\(roundGroundPace \/ actionsPerRound\)\)/);

console.log("initiative actions source contract: passed");
