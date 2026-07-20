import { initializeGrappleState } from "../grapplingSystem.js";
import { restoreRetainedWeaponAfterGrapple } from "./grappleWeaponTransitions.js";

export function buildGrappleRelationshipId({ actorId, opponentId, generationId = "default", executionKey = null } = {}) {
  const [first, second] = [actorId || "unknown-a", opponentId || "unknown-b"].sort();
  return [generationId || "default", first, second, executionKey || "relationship"].join(":");
}

export function clearGrappleStateForActor(actor = {}) {
  return restoreRetainedWeaponAfterGrapple({
    ...actor,
    sharedHex: undefined,
    grappleOrigin: undefined,
    grappleController: undefined,
    grappleAdvantage: undefined,
    grappleState: {
      ...initializeGrappleState(actor),
      state: "neutral",
      opponent: null,
      opponentId: null,
      sharedHex: null,
      attackerOrigin: null,
      controllerId: null,
      hasGrappleAdvantage: false,
      canUseLongWeapons: true,
      roundsInGrapple: 0,
      grappleId: null,
      establishedRound: null,
      lastAdvancedRound: null,
      penalties: { attack: 0, block: 0, evade: 0 },
    },
  }, { reason: "grapple-relationship-ended" });
}

export function endGrappleRelationship({
  fighters = [],
  actorId,
  opponentId,
  grappleId = null,
  reason = "forced-separation",
  generationId = "default",
} = {}) {
  const resolvedGrappleId = grappleId || buildGrappleRelationshipId({ actorId, opponentId, generationId });
  const ended = new Set([actorId, opponentId].filter(Boolean));
  return {
    grappleId: resolvedGrappleId,
    actorId,
    opponentId,
    reason,
    generationId,
    fighters: (fighters || []).map((fighter) => (
      ended.has(fighter?.id) ? clearGrappleStateForActor(fighter) : fighter
    )),
  };
}

export default {
  buildGrappleRelationshipId,
  clearGrappleStateForActor,
  endGrappleRelationship,
};
