import { getCanonicalCombatActorDefinition } from "../../data/canonicalCombatActors.js";
import { selectSurrenderResolution, selectSurrenderResponse } from "../behavior/selectSurrenderResolution.js";
import {
  claimSurrenderDecisionOwner, commitSurrenderResolution, commitSurrenderResponse, createCanonicalSurrenderOffer,
  createSurrenderDecisionToken, createSurrenderLifecycleRegistry, finalizeResolvedSurrenderEncounter,
  getAuthoritativeManualSurrenderDecision,
} from "./surrenderLifecycle.js";

function runAiScenario({ victorKey, surrenderedKey, reason, rngValue = 0, factionOrders = null, grounded = false }) {
  const registry = createSurrenderLifecycleRegistry();
  const victor = { ...structuredClone(getCanonicalCombatActorDefinition(victorKey)), id: `victor-${victorKey}`, team: "party", controlMode: "ai", position: { x: 2, y: 2 } };
  const surrenderedActor = {
    ...structuredClone(getCanonicalCombatActorDefinition(surrenderedKey)), id: `surrendered-${surrenderedKey}`, team: "enemy", position: { x: 2, y: 2 }, currentHP: 4, currentStamina: 0,
    ...(grounded ? { grappleState: { state: "grapple_ground", positionState: "ground", opponent: victor.id, groundControl: { state: "pinned", controllerId: victor.id, controlledId: `surrendered-${surrenderedKey}` } } } : {}),
  };
  if (grounded) victor.grappleState = { state: "grapple_ground", positionState: "ground", opponent: surrenderedActor.id, groundControl: surrenderedActor.grappleState.groundControl };
  const offer = createCanonicalSurrenderOffer({ registry, surrenderingActor: surrenderedActor, receivingActor: victor, reason, generationId: `scenario:${victorKey}:${surrenderedKey}`, round: 2, initiativeTurnId: "scenario-turn", actionToken: "scenario-action:1" });
  const responseSelection = selectSurrenderResponse({ victor, surrenderedActor: offer.fighter, factionOrders, rng: () => rngValue });
  const response = commitSurrenderResponse({ registry, surrenderingActor: offer.fighter, token: createSurrenderDecisionToken({ record: offer.record, decisionOwnerId: victor.id, phase: "response", actionToken: "scenario-decision:1" }), response: responseSelection.selectedDecision });
  if (!response.committed || response.combatContinues) return { registry, victor, surrenderedActor, offer, responseSelection, response, resolutionSelection: null, resolution: null, finalized: null };
  const resolutionSelection = selectSurrenderResolution({ victor, surrenderedActor: response.fighter, factionOrders, battlefieldContext: { guardsAvailable: 1, restraintsAvailable: 1, witnesses: 2, prisonerValue: surrenderedActor.prisonerValue || 2, allowExecution: false }, rng: () => rngValue });
  const resolution = commitSurrenderResolution({ registry, surrenderedActor: response.fighter, victor, token: createSurrenderDecisionToken({ record: offer.record, decisionOwnerId: victor.id, phase: "victor-decision", decisionSequence: 2, actionToken: "scenario-decision:2" }), decision: resolutionSelection.selectedDecision, round: 2 });
  const finalized = finalizeResolvedSurrenderEncounter({ registry, surrenderIds: [offer.record.surrenderId] });
  return { registry, victor, surrenderedActor, offer, responseSelection, response, resolutionSelection, resolution, finalized };
}

export function runPhase3B3BSurrenderScenarios() {
  return {
    knightReceivesGoblin: runAiScenario({ victorKey: "knight", surrenderedKey: "goblin-warrior", reason: "routed-exhausted-cower", rngValue: 0 }),
    goblinReceivesKnight: runAiScenario({ victorKey: "goblin-warrior", surrenderedKey: "knight", reason: "voluntary-surrender", rngValue: 0.35, factionOrders: { prisonerPolicy: "prefer-ransom" } }),
    minotaurReceivesSurrender: runAiScenario({ victorKey: "minotaur", surrenderedKey: "goblin-warrior", reason: "scripted-battlefield-command", rngValue: 0.2 }),
    groundedSurrender: runAiScenario({ victorKey: "knight", surrenderedKey: "goblin-warrior", reason: "grounded-demand-surrender", rngValue: 0, grounded: true, factionOrders: { prisonerPolicy: "prefer-capture" } }),
  };
}

export function runPhase3B3BModalOwnershipScenarios() {
  const generationId = "browser-modal-ownership";
  const knight = { ...structuredClone(getCanonicalCombatActorDefinition("knight")), id: "modal-knight", team: "party", controlMode: "ai" };
  const minotaur = { ...structuredClone(getCanonicalCombatActorDefinition("minotaur")), id: "modal-minotaur", team: "enemy", controlMode: "ai", currentHP: 10, currentStamina: 0 };
  const goblin = { ...structuredClone(getCanonicalCombatActorDefinition("goblin-warrior")), id: "remaining-goblin", team: "enemy", controlMode: "ai", currentHP: 8 };
  const aiRegistry = createSurrenderLifecycleRegistry();
  const aiOffer = createCanonicalSurrenderOffer({ registry: aiRegistry, surrenderingActor: minotaur, receivingActor: knight, reason: "routed-exhausted-cower", generationId, round: 4, actionToken: "modal-ai-offer" });
  const aiClaim = claimSurrenderDecisionOwner({ registry: aiRegistry, surrenderId: aiOffer.record.surrenderId, type: "player-ai", actorId: knight.id, generationId, phase: "response" });
  const aiPanel = getAuthoritativeManualSurrenderDecision({ registry: aiRegistry, generationId, actors: [knight, aiOffer.fighter, goblin], getControlMode: (actor) => actor.controlMode });
  const aiResponse = commitSurrenderResponse({ registry: aiRegistry, surrenderingActor: aiOffer.fighter, token: createSurrenderDecisionToken({ record: aiOffer.record, decisionOwnerId: knight.id, phase: "response", actionToken: "modal-ai-response" }), response: "accept" });
  claimSurrenderDecisionOwner({ registry: aiRegistry, surrenderId: aiOffer.record.surrenderId, type: "player-ai", actorId: knight.id, generationId, phase: "victor-decision" });
  const aiResolution = commitSurrenderResolution({ registry: aiRegistry, surrenderedActor: aiResponse.fighter, victor: knight, token: createSurrenderDecisionToken({ record: aiOffer.record, decisionOwnerId: knight.id, phase: "victor-decision", actionToken: "modal-ai-resolution" }), decision: "disarmAndRelease", round: 4 });

  const manualRegistry = createSurrenderLifecycleRegistry();
  const manualKnight = { ...knight, controlMode: "manual" };
  const manualOffer = createCanonicalSurrenderOffer({ registry: manualRegistry, surrenderingActor: minotaur, receivingActor: manualKnight, reason: "routed-exhausted-cower", generationId, round: 4, actionToken: "modal-manual-offer" });
  claimSurrenderDecisionOwner({ registry: manualRegistry, surrenderId: manualOffer.record.surrenderId, type: "manual", actorId: manualKnight.id, generationId, phase: "response" });
  const responsePanel = getAuthoritativeManualSurrenderDecision({ registry: manualRegistry, generationId, actors: [manualKnight, manualOffer.fighter], getControlMode: (actor) => actor.controlMode });
  const manualResponse = commitSurrenderResponse({ registry: manualRegistry, surrenderingActor: manualOffer.fighter, token: createSurrenderDecisionToken({ record: manualOffer.record, decisionOwnerId: manualKnight.id, phase: "response", actionToken: "modal-manual-response" }), response: "accept" });
  claimSurrenderDecisionOwner({ registry: manualRegistry, surrenderId: manualOffer.record.surrenderId, type: "manual", actorId: manualKnight.id, generationId, phase: "victor-decision" });
  const victorPanel = getAuthoritativeManualSurrenderDecision({ registry: manualRegistry, generationId, actors: [manualKnight, manualResponse.fighter], getControlMode: (actor) => actor.controlMode });
  const manualResolution = commitSurrenderResolution({ registry: manualRegistry, surrenderedActor: manualResponse.fighter, victor: manualKnight, token: createSurrenderDecisionToken({ record: manualOffer.record, decisionOwnerId: manualKnight.id, phase: "victor-decision", actionToken: "modal-manual-resolution" }), decision: "takePrisoner", round: 4 });
  const closedPanel = getAuthoritativeManualSurrenderDecision({ registry: manualRegistry, generationId, actors: [manualKnight, manualResolution.fighter], getControlMode: (actor) => actor.controlMode });

  return {
    ai: { registry: aiRegistry, claim: aiClaim, panel: aiPanel, response: aiResponse, resolution: aiResolution, hostileGoblinRemains: goblin.currentHP > 0 },
    manual: { registry: manualRegistry, responsePanel, response: manualResponse, victorPanel, resolution: manualResolution, closedPanel, exportControlsExpected: ["Copy Entire Log", "Download Entire Log"] },
  };
}

export default runPhase3B3BSurrenderScenarios;
