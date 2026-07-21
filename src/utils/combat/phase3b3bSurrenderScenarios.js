import { getCanonicalCombatActorDefinition } from "../../data/canonicalCombatActors.js";
import { selectSurrenderResolution, selectSurrenderResponse } from "../behavior/selectSurrenderResolution.js";
import {
  commitSurrenderResolution, commitSurrenderResponse, createCanonicalSurrenderOffer,
  createSurrenderDecisionToken, createSurrenderLifecycleRegistry, finalizeResolvedSurrenderEncounter,
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

export default runPhase3B3BSurrenderScenarios;
