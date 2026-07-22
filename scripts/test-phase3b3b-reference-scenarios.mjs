import assert from "node:assert/strict";
import { runPhase3B3BModalOwnershipScenarios, runPhase3B3BSurrenderScenarios } from "../src/utils/combat/phase3b3bSurrenderScenarios.js";

const scenarios = runPhase3B3BSurrenderScenarios();
const knight = scenarios.knightReceivesGoblin;
assert.equal(knight.responseSelection.selectedDecision, "accept");
assert.equal(knight.response.committed, true);
assert.equal(knight.resolution.committed, true);
assert.equal(knight.resolution.terminalResult, false);
assert.equal(knight.finalized.finalized, true);
assert.equal(knight.resolution.events.some((event) => event.eventType === "surrendered-opponent-executed"), false);

const goblin = scenarios.goblinReceivesKnight;
assert.equal(goblin.resolutionSelection.scores.setRansomDisposition > 0, true);
assert.equal(goblin.resolution.terminalResult, false);
assert.equal(goblin.resolution.fighter.species, "human");

const minotaur = scenarios.minotaurReceivesSurrender;
assert.equal(minotaur.victor.species, "minotaur");
assert.equal(minotaur.resolutionSelection.scores.executeSurrenderedOpponent, 0);
assert.notEqual(minotaur.resolutionSelection.selectedDecision, "executeSurrenderedOpponent");
assert.equal(minotaur.resolution.events.some((event) => /attack|gore|axe/i.test(event.eventType)), false);

const grounded = scenarios.groundedSurrender;
assert.equal(grounded.offer.fighter.grappleState.state, "grapple_ground");
assert.equal(grounded.response.fighter.grappleState.state, "grapple_ground");
assert.equal(grounded.response.fighter.currentHP, grounded.surrenderedActor.currentHP);
assert.equal(grounded.resolution.committed, true);
assert.equal(grounded.resolution.releaseGrapple, true);
assert.equal(grounded.resolution.events.filter((event) => event.eventType === "surrender-resolution-committed").length, 1);

const modal = runPhase3B3BModalOwnershipScenarios();
assert.equal(modal.ai.panel, null);
assert.equal(modal.ai.resolution.events.filter((event) => event.eventType === "surrender-resolution-committed").length, 1);
assert.equal(modal.ai.hostileGoblinRemains, true);
assert.equal(modal.manual.responsePanel.phase, "response");
assert.equal(modal.manual.victorPanel.phase, "victor-decision");
assert.equal(modal.manual.closedPanel, null);
assert.equal(modal.manual.resolution.fighter.combatState, "captured");
console.log("Phase 3B3B reference surrender scenarios passed");
