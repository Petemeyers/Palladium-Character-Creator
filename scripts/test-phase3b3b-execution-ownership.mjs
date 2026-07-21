import assert from "node:assert/strict";
import {
  commitSurrenderResolution, commitSurrenderResponse, createCanonicalSurrenderOffer,
  createSurrenderDecisionToken, createSurrenderLifecycleRegistry,
} from "../src/utils/combat/surrenderLifecycle.js";

const victor = { id: "victor", name: "Victor" };
const target = { id: "target", name: "Target", currentHP: 8, hp: 8, HP: 8, position: { x: 2, y: 2 }, attacks: [{ name: "Sword" }] };
const registry = createSurrenderLifecycleRegistry();
const offer = createCanonicalSurrenderOffer({ registry, surrenderingActor: target, receivingActor: victor, reason: "voluntary", generationId: "execution", round: 2 });
const response = commitSurrenderResponse({ registry, surrenderingActor: offer.fighter, token: createSurrenderDecisionToken({ record: offer.record, decisionOwnerId: victor.id, phase: "response", actionToken: "explicit-response-token" }), response: "accept" });
assert.equal(commitSurrenderResolution({ registry, surrenderedActor: response.fighter, victor, token: null, decision: "executeSurrenderedOpponent" }).committed, false);
const wrongToken = createSurrenderDecisionToken({ record: offer.record, decisionOwnerId: "stale-owner", phase: "victor-decision" });
const wrongOwner = commitSurrenderResolution({ registry, surrenderedActor: response.fighter, victor, token: wrongToken, decision: "executeSurrenderedOpponent" });
assert.equal(wrongOwner.committed, false);
assert.equal(wrongOwner.events[0].eventType, "surrender-resolution-token-rejected");
const validTokenWrongParticipants = createSurrenderDecisionToken({ record: offer.record, decisionOwnerId: victor.id, phase: "victor-decision", actionToken: "wrong-participants" });
const wrongParticipants = commitSurrenderResolution({ registry, surrenderedActor: { ...response.fighter, id: "other-target" }, victor, token: validTokenWrongParticipants, decision: "executeSurrenderedOpponent" });
assert.equal(wrongParticipants.committed, false);
assert.equal(wrongParticipants.reason, "surrender-participant-identity-mismatch");
assert.equal(response.fighter.currentHP, 8);
const token = createSurrenderDecisionToken({ record: offer.record, decisionOwnerId: victor.id, phase: "victor-decision", actionToken: "explicit-execution-token" });
const executed = commitSurrenderResolution({ registry, surrenderedActor: response.fighter, victor, token, decision: "executeSurrenderedOpponent", round: 2 });
assert.equal(executed.committed, true);
assert.equal(executed.terminalResult, true);
assert.equal(executed.fighter.currentHP, 0);
assert.equal(executed.fighter.dead, true);
assert.equal(executed.events.filter((entry) => entry.eventType === "surrendered-opponent-executed").length, 1);
assert.equal(executed.events.some((entry) => /attack|armor|grapple.*strike/i.test(entry.eventType)), false);
assert.equal(commitSurrenderResolution({ registry, surrenderedActor: response.fighter, victor, token, decision: "executeSurrenderedOpponent" }).committed, false);
console.log("Phase 3B3B explicit execution ownership passed");
