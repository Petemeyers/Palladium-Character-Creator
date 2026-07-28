import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const resetFunction = source.indexOf("function resetCombatExecutionState");
const generationPublish = source.indexOf("combatSessionRef.current = reset.generationId", resetFunction);
const coordinatePublish = source.indexOf("meleeRoundRef.current = reset.round", resetFunction);
const startFunction = source.indexOf("function startCombat");
const resetInvocation = source.indexOf("resetCombatExecutionState({", startFunction);
const rosterNormalization = source.indexOf("let updatedFighters = combatRoster.map", startFunction);
const initiativeRoll = source.indexOf("rollAndLogRoundInitiative(updatedFighters", startFunction);
const rosterCommit = source.indexOf("fightersRef.current = updatedFighters", startFunction);

assert.ok(resetFunction >= 0, "CombatPage must own one canonical reset transaction");
assert.ok(generationPublish > resetFunction && coordinatePublish > generationPublish);
assert.ok(resetInvocation > startFunction && resetInvocation < rosterNormalization);
assert.ok(rosterNormalization < initiativeRoll && initiativeRoll < rosterCommit);
assert.match(source.slice(resetFunction, startFunction), /weaponExchangeRegistryRef\.current\.clear\(\)/);
assert.match(source.slice(resetFunction, startFunction), /reactionOpportunityRegistryRef\.current\.clear\(\)/);
assert.match(source.slice(resetFunction, startFunction), /remainingActionContinuationRegistryRef\.current\.clear\(\)/);
assert.match(source, /eventType: "combat-reset-coordinate-audit"/);
assert.match(source, /eventType: "initiative-display-identity-audit"/);
assert.match(source, /eventType: schedulerAudit\.eventType/);
assert.match(source, /eventType: "stale-attack-promise-ignored"/);
assert.doesNotMatch(source, /stale attack promise resolved with actor mismatch/);
assert.match(source, /eventType: "grapple-completion-action-count-audit"/);
assert.doesNotMatch(source, /eventType: "combat-action-completion-committed-state-mismatch"/);
assert.match(source, /immutableIncomingArmoredPlan\?\.attackSnapshot/);
assert.match(source, /source-weapon-no-longer-equipped/);
assert.match(source, /eventType: "armored-action-plan-identity-audit"/);
assert.match(source, /preparedCombatGenerationRef\.current === combatSessionRef\.current/);
assert.match(source, /advanceGeneration: !reusePreparedGeneration/);
assert.match(source, /preparedCombatGenerationRef\.current = combatReset\.reset\.generationId/);

console.log("Phase 3.1 CombatPage integration tests passed");
