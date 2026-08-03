import assert from "node:assert/strict";
import { createTacticalPostParryRuntime, openTacticalPostParryWindow, progressTacticalPostParryWindows, auditTacticalPostParryOwnership } from "../src/utils/combat/tacticalPostParryWindow.js";
import { defense, offer } from "./tactical-post-parry-test-helpers.mjs";
const runtime = createTacticalPostParryRuntime({ generationId: 1, combatSession: 1, maxHistory: 42, maxClaims: 48 });
const roster = Array.from({ length: 42 }, (_, index) => ({ id: `actor-${index}`, team: index % 2 ? "enemy" : "party", currentHP: 20, controlMode: "ai" }));
for (let index = 0; index < 80; index += 1) {
  const defender = roster[(index * 2) % 42];
  const attacker = roster[((index * 2) + 1) % 42];
  const identity = `response-${index}`;
  const opened = openTacticalPostParryWindow({ runtime, defenseResult: defense("parry_advantage", { reactionResponseId: identity, responderId: defender.id, sourceDefenderId: defender.id, sourceAttackerId: attacker.id, sourceExecutionKey: `attack-${index}` }), canonicalOffer: offer("parry_advantage", { reactionId: `offer-${index}`, opportunityId: `offer-${index}`, sourceAttackExecutionKey: `attack-${index}` }), pulseIndex: index * 2 + 1, fighters: roster, controlMode: "ai" });
  assert.equal(opened.accepted, true);
  await progressTacticalPostParryWindows({ runtime, pulseIndex: index * 2 + 2, fighters: roster, executeCanonicalResponse: () => ({ accepted: true }) });
}
const audit = auditTacticalPostParryOwnership(runtime);
assert.equal(audit.matches, true);
assert.equal(audit.openPostParryWindowCount, 0);
assert.ok(audit.terminalHistoryCount <= 42);
assert.ok(audit.consumedOfferKeyCount <= 48);
assert.ok(audit.responseExecutionKeyCount <= 48);
assert.ok(audit.sourceResponseIdentityCount <= 48);
console.log("tactical 42 actor post-parry runtime tests passed");
