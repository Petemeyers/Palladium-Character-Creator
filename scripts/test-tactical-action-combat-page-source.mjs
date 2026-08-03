import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
for (const control of ["Prepare Attack", "Cancel Preparation", "Release Ready Attack", "Hold"]) {
  assert.match(page, new RegExp(`>\\s*${control}\\s*<`), `${control} control must be present`);
}
assert.match(page, /registerTacticalAction\(tacticalPulseRuntimeRef\.current\.actionRuntime/);
assert.match(page, /tacticalAttackExecutorRef\.current/);
assert.match(page, /createAttackExecutionKey\(actor\.id, target\.id, "tactical-pulse-attack"/);
assert.match(page, /attack\(tacticalActor, target\.id/);
assert.match(page, /suppressSequentialTurnAdvance: true/);
assert.match(page, /suppressActionSpend: true/);
assert.match(page, /getInventoryAmmoCount\(actor, ammoType\)/);
assert.match(page, /cleanupTacticalActionRuntime\(previousTacticalRuntime\.actionRuntime, "combat-reset"\)/);
assert.match(page, /manual-tactical-action-awaiting-input", forceHold: true/);
assert.match(page, /registerTacticalAction\([\s\S]*releaseRequested: false/);
assert.match(page, /requestTacticalActionRelease\(tacticalPulseRuntimeRef\.current\.actionRuntime, actorId, expected\)/);
assert.match(page, /cancelTacticalAction\([\s\S]*"manual-cancel",[\s\S]*expected/);
assert.match(page, /getFighterControlMode\(actor\) !== "manual"/);
assert.match(page, /buildArmoredTechniqueAttack\(selectedTacticalAttack, admission\.techniqueId\)/);
assert.doesNotMatch(page, /releaseManualTacticalAttack[\s\S]{0,800}attack\(/, "manual release handler must not call attack directly");
console.log("tactical action CombatPage source integration tests passed");
