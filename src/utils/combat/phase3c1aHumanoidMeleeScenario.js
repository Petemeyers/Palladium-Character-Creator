import { getCanonicalCombatActorDefinition } from "../../data/canonicalCombatActors.js";
import { getCombatIconAppearance } from "../presentation/getCombatIconAppearance.js";
import { normalizeReferenceCombatActor } from "./normalizeCombatActorSchema.js";
import { resolveGrappleWeaponDisposition } from "./grappleWeaponTransitions.js";
import {
  claimSurrenderDecisionOwner,
  commitCanonicalSurrenderOfferToRoster,
  commitSurrenderResolution,
  commitSurrenderResponse,
  createSurrenderDecisionToken,
  createSurrenderLifecycleRegistry,
  finalizeResolvedSurrenderEncounter,
  shouldDeferEncounterFinalizationForCanonicalSurrender,
} from "./surrenderLifecycle.js";
import { validateCombatActor } from "./validateCombatActor.js";

const clone = (value) => JSON.parse(JSON.stringify(value));

const SIDE_KEYS = Object.freeze({
  party: ["squire", "spearman", "brigand"],
  enemy: ["guard", "bandit", "orc"],
});

export function runPhase3C1AHumanoidMeleeScenario() {
  const generationId = "phase3c1a:mixed-humanoid-battle";
  const diagnostics = [];
  const roster = Object.entries(SIDE_KEYS).flatMap(([team, keys], sideIndex) => keys.map((actorKey, index) => {
    const definition = getCanonicalCombatActorDefinition(actorKey);
    return normalizeReferenceCombatActor({
      ...definition,
      id: `${team}:${actorKey}`,
      instanceId: `${generationId}:${team}:${actorKey}`,
      team,
      side: team,
      battleSide: team,
      type: team === "party" ? "player" : "enemy",
      controlMode: "ai",
      position: { x: sideIndex * 8 + index, y: index },
      currentHP: definition.derivedStats.hp,
      currentStamina: definition.combatStamina.current,
    }, { source: "phase3c1a-reference-setup", emitDiagnostic: (entry) => diagnostics.push(entry) }).normalizedActor;
  }));

  const validations = roster.map((actor) => validateCombatActor(actor));
  const initiative = roster.map((actor, initiativeIndex) => ({
    actorId: actor.id,
    initiativeIndex,
    initiativeTurnId: `${generationId}:round:1:index:${initiativeIndex}:actor:${actor.id}`,
  }));
  const actionLedger = initiative.map((turn) => ({
    ...turn,
    actionToken: `${turn.initiativeTurnId}:action:1`,
    ownerType: turn.actorId.startsWith("party:") ? "player-ai" : "enemy-ai",
    completed: true,
  }));

  const spearman = roster.find((actor) => actor.actorKey === "spearman");
  const orc = roster.find((actor) => actor.actorKey === "orc");
  const twoHandedTransitions = [spearman, orc].map((actor) => resolveGrappleWeaponDisposition({
    fighter: actor,
    readyWeapon: actor.weaponProfiles[0],
    position: actor.position,
    initiativeTurnId: actionLedger.find((entry) => entry.actorId === actor.id).initiativeTurnId,
    actionToken: actionLedger.find((entry) => entry.actorId === actor.id).actionToken,
    round: 1,
  }));

  const registry = createSurrenderLifecycleRegistry();
  const surrenderingActor = { ...roster.find((actor) => actor.actorKey === "bandit"), currentHP: 2, currentStamina: 0, moraleState: { status: "ROUTED" } };
  const receivingActor = roster.find((actor) => actor.actorKey === "squire");
  const offer = commitCanonicalSurrenderOfferToRoster({
    registry,
    fighters: roster.map((actor) => actor.id === surrenderingActor.id ? surrenderingActor : actor),
    surrenderingActor,
    receivingActor,
    reason: "routed-exhausted-cower",
    generationId,
    round: 2,
    initiativeTurnId: `${generationId}:round:2:bandit`,
    actionToken: `${generationId}:round:2:bandit:action:1`,
  });
  const gateAtOffer = shouldDeferEncounterFinalizationForCanonicalSurrender({ registry, generationId });
  const responseClaim = claimSurrenderDecisionOwner({ registry, surrenderId: offer.record.surrenderId, type: "player-ai", actorId: receivingActor.id, generationId, phase: "response" });
  const response = commitSurrenderResponse({
    registry,
    surrenderingActor: offer.fighter,
    token: createSurrenderDecisionToken({ record: offer.record, decisionOwnerId: receivingActor.id, phase: "response", actionToken: `${generationId}:surrender:response` }),
    response: "accept",
    responseReason: "deterministic-reference",
  });
  const decisionClaim = claimSurrenderDecisionOwner({ registry, surrenderId: offer.record.surrenderId, type: "player-ai", actorId: receivingActor.id, generationId, phase: "victor-decision" });
  const resolution = commitSurrenderResolution({
    registry,
    surrenderedActor: response.fighter,
    victor: receivingActor,
    token: createSurrenderDecisionToken({ record: offer.record, decisionOwnerId: receivingActor.id, phase: "victor-decision", actionToken: `${generationId}:surrender:resolution` }),
    decision: "takePrisoner",
    round: 2,
  });
  const finalized = finalizeResolvedSurrenderEncounter({ registry, surrenderIds: [offer.record.surrenderId] });
  const duplicateFinalization = finalizeResolvedSurrenderEncounter({ registry, surrenderIds: [offer.record.surrenderId] });
  const gateAfterResolution = shouldDeferEncounterFinalizationForCanonicalSurrender({ registry, generationId });
  const finalRoster = offer.fighters.map((actor) => actor.id === resolution.fighter.id ? resolution.fighter : actor);
  const iconAppearances = Object.fromEntries(finalRoster.map((actor) => [actor.id, getCombatIconAppearance({ fighter: actor, activeFighterId: initiative[0].actorId, generationId, activeGenerationId: generationId })]));
  const schemaWarnings = validations.flatMap((result) => result.warnings).filter((warning) => ["unmigrated-actor-schema", "inventory-weapon-without-profile"].includes(warning.code));

  return clone({
    generationId,
    roster: finalRoster,
    diagnostics,
    validations: validations.map((result) => ({ valid: result.valid, errors: result.errors, warnings: result.warnings })),
    schemaWarnings,
    initiative,
    actionLedger,
    twoHandedTransitions,
    surrender: {
      offerAccepted: offer.accepted,
      gateAtOffer,
      responseOwnerClaimed: responseClaim.claimed,
      responseCommitted: response.committed,
      decisionOwnerClaimed: decisionClaim.claimed,
      resolutionCommitted: resolution.committed,
      finalizationCommitted: finalized.finalized,
      duplicateFinalizationBlocked: !duplicateFinalization.finalized,
      gateAfterResolution,
      combatOverCount: finalized.finalized && !gateAfterResolution.defer ? 1 : 0,
    },
    iconAppearances,
  });
}

export default runPhase3C1AHumanoidMeleeScenario;
