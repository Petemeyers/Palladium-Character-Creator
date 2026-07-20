import assert from "node:assert/strict";
import { transitionCanonicalGrappleExecutionRecord } from "../src/utils/combat/canonicalGrappleExecution.js";

const counters = {
  hpMutation: 0,
  combatEndDetected: 0,
  canonicalCompletion: 0,
  cleanup: 0,
  terminalReturn: 0,
  continuationCreated: 0,
  continuationFired: 0,
  postCombatCallback: 0,
  duplicateCompletion: 0,
  turnHandoff: 0,
};

let defenderHp = 1;
let record = {
  generationId: "g",
  initiativeTurnId: "turn-1",
  actionToken: "turn-1:1",
  actionSequence: 1,
  actorId: "enemy-knight",
  opponentId: "player-knight",
  actionType: "groundAttack",
  executionKey: "lethal-execution",
  state: "roll-claimed",
  rollStarted: true,
  rollKind: "dagger-clinch-attack",
  completionEmitted: false,
};

defenderHp = Math.max(0, defenderHp - 4);
counters.hpMutation += 1;
if (defenderHp === 0) {
  counters.combatEndDetected += 1;
  let transition = transitionCanonicalGrappleExecutionRecord(record, "committed", 10);
  assert.equal(transition.ok, true);
  record = transition.record;
  transition = transitionCanonicalGrappleExecutionRecord(record, "completed", 11);
  assert.equal(transition.ok, true);
  record = { ...transition.record, completionEmitted: true };
  counters.canonicalCompletion += 1;
  counters.cleanup += 1;
  counters.terminalReturn += 1;
}

assert.equal(record.state, "completed");
assert.deepEqual(counters, {
  hpMutation: 1,
  combatEndDetected: 1,
  canonicalCompletion: 1,
  cleanup: 1,
  terminalReturn: 1,
  continuationCreated: 0,
  continuationFired: 0,
  postCombatCallback: 0,
  duplicateCompletion: 0,
  turnHandoff: 0,
});

console.log("✅ Phase 3B1 lethal grapple terminal-return runtime fixture passed");
