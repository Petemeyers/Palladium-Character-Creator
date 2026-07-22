import { getCanonicalCombatActorDefinition } from "../../data/canonicalCombatActors.js";
import {
  commitSurrenderResolution,
  commitSurrenderResponse,
  createCanonicalSurrenderOffer,
  createSurrenderDecisionToken,
  createSurrenderLifecycleRegistry,
} from "../combat/surrenderLifecycle.js";
import { getCombatIconAppearance } from "./getCombatIconAppearance.js";

const generationId = "combat-icon-scenario";
const appearance = (fighter, options = {}) => getCombatIconAppearance({ fighter, generationId, ...options });

function resolveSurrender(decision) {
  const registry = createSurrenderLifecycleRegistry();
  const knight = { ...structuredClone(getCanonicalCombatActorDefinition("knight")), id: `knight-${decision}`, team: "party" };
  const minotaur = { ...structuredClone(getCanonicalCombatActorDefinition("minotaur")), id: `minotaur-${decision}`, team: "enemy", currentHP: 10 };
  const offer = createCanonicalSurrenderOffer({ registry, surrenderingActor: minotaur, receivingActor: knight, reason: "scenario", generationId, round: 1, actionToken: `offer-${decision}` });
  const response = commitSurrenderResponse({ registry, surrenderingActor: offer.fighter, token: createSurrenderDecisionToken({ record: offer.record, decisionOwnerId: knight.id, phase: "response", actionToken: `response-${decision}` }), response: "accept" });
  const resolution = commitSurrenderResolution({ registry, surrenderedActor: response.fighter, victor: knight, token: createSurrenderDecisionToken({ record: offer.record, decisionOwnerId: knight.id, phase: "victor-decision", actionToken: `resolution-${decision}`, explicitExecutionAuthority: decision === "executeSurrenderedOpponent" }), decision, round: 1 });
  return { registry, knight, minotaur, offer, response, resolution };
}

export function runCombatIconAppearanceScenarios() {
  const knight = { ...structuredClone(getCanonicalCombatActorDefinition("knight")), id: "icon-knight", team: "party" };
  const goblin = { ...structuredClone(getCanonicalCombatActorDefinition("goblin-warrior")), id: "icon-goblin", team: "enemy", moraleState: { status: "ROUTED" } };
  const minotaur = { ...structuredClone(getCanonicalCombatActorDefinition("minotaur")), id: "icon-minotaur", team: "enemy" };
  const pendingRegistry = createSurrenderLifecycleRegistry();
  const pending = createCanonicalSurrenderOffer({ registry: pendingRegistry, surrenderingActor: minotaur, receivingActor: knight, reason: "routed-exhausted-cower", generationId, round: 1, actionToken: "pending-offer" });
  const surrendered = resolveSurrender("acceptYieldWithoutCapture");
  const captured = resolveSurrender("takePrisoner");
  const executed = resolveSurrender("executeSurrenderedOpponent");
  return {
    generationId,
    partyKnight: appearance(knight),
    activeKnight: appearance(knight, { activeFighterId: knight.id }),
    selectedKnight: appearance(knight, { selectedFighterId: knight.id }),
    grappledKnight: appearance({ ...knight, grappleState: { state: "grapple_standing", opponent: goblin.id } }),
    targetedGoblin: appearance(goblin, { targetFighterId: goblin.id }),
    routedGoblin: appearance(goblin),
    proneGoblin: appearance({ ...goblin, moraleState: { status: "STEADY" }, isProne: true }),
    enemyMinotaur: appearance(minotaur),
    pendingMinotaur: appearance(pending.fighter, { surrenderRecord: pending.record }),
    surrenderedMinotaur: appearance(surrendered.resolution.fighter),
    capturedMinotaur: appearance(captured.resolution.fighter),
    unconsciousGoblin: appearance({ ...goblin, moraleState: { status: "STEADY" }, isUnconscious: true }),
    deadGoblin: appearance(executed.resolution.fighter, { activeFighterId: executed.resolution.fighter.id }),
  };
}

export default runCombatIconAppearanceScenarios;
