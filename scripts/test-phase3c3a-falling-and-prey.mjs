import assert from "node:assert/strict";
import fs from "node:fs";
import {
  claimCanonicalFall,
  createCanonicalFallRegistry,
  resolveCanonicalFall,
} from "../src/utils/combat/canonicalFallingState.js";
import {
  createCanonicalCarrierRegistry,
  establishCanonicalCarrierLink,
  establishPreyControl,
  resolvePreyStruggle,
} from "../src/utils/combat/canonicalCarrierLink.js";
import {
  runPhase3C3AHawkPreyScenario,
  runPhase3C3AStaleCallbackScenario,
} from "../src/utils/combat/phase3c3aCarrierScenarios.js";

let assertions = 0;
const equal = (...args) => { assertions++; assert.equal(...args); };
const ok = (...args) => { assertions++; assert.ok(...args); };

const actor = {
  id: "falling:actor",
  name: "Falling Actor",
  currentHP: 10,
  hp: 10,
  position: { x: 2, y: 2, altitudeFeet: 20 },
};
const owner = {
  generationId: "g:fall",
  initiativeTurnId: "g:fall:turn:1",
  actionToken: "g:fall:turn:1:action:1",
};
const registry = createCanonicalFallRegistry();
const claim = claimCanonicalFall({
  registry, actor, ...owner, fallId: "fall:1",
  startingAltitudeFeet: 20, landingPosition: { x: 2, y: 2, altitudeFeet: 0 },
});
equal(claim.accepted, true);
equal(claim.fallState.state, "claimed");
equal(claim.events[0].eventType, "fall-state-started");
equal(actor.currentHP, 10);

let authorized = 0;
let impacts = 0;
const resolved = resolveCanonicalFall({
  registry, fallId: claim.fallId, actor, ...owner,
  authorizeImpact: () => { authorized++; return { accepted: true }; },
  resolveImpact: ({ actor: current }) => { impacts++; return { actor: current, damage: 0 }; },
});
equal(resolved.accepted, true);
equal(authorized, 1);
equal(impacts, 1);
equal(resolved.actor.currentHP, 10);
equal(resolved.actor.position.altitudeFeet, 0);
equal(resolved.actor.prone, true);
equal(resolved.fallState.state, "completed");
equal(resolved.events[0].eventType, "fall-impact-authorized");
equal(resolved.events[1].eventType, "fall-state-completed");
const duplicate = resolveCanonicalFall({ registry, fallId: claim.fallId, actor, ...owner });
equal(duplicate.accepted, false);
equal(duplicate.reason, "duplicate-fall");
equal(duplicate.actor.currentHP, 10);

const staleRegistry = createCanonicalFallRegistry();
const staleClaim = claimCanonicalFall({
  registry: staleRegistry, actor, ...owner, fallId: "fall:stale",
  startingAltitudeFeet: 15,
});
const stale = resolveCanonicalFall({
  registry: staleRegistry, fallId: staleClaim.fallId, actor,
  ...owner, generationId: "g:new",
  resolveImpact: () => { throw new Error("stale impact must not execute"); },
});
equal(stale.accepted, false);
equal(stale.reason, "stale-fall-callback");
equal(stale.actor.position.altitudeFeet, 20);
equal(stale.actor.currentHP, 10);

const hawkScenario = runPhase3C3AHawkPreyScenario();
equal(hawkScenario.control.accepted, true);
equal(hawkScenario.linked.accepted, true);
equal(hawkScenario.movement.accepted, true);
equal(hawkScenario.movement.passenger.position.x, hawkScenario.movement.carrier.position.x);
equal(hawkScenario.movement.passenger.position.altitudeFeet, 30);
equal(hawkScenario.struggle.accepted, true);
equal(hawkScenario.struggle.escaped, false);
equal(hawkScenario.released.accepted, true);
equal(hawkScenario.released.fallClaim.accepted, true);
equal(hawkScenario.fall.accepted, true);
equal(hawkScenario.fall.actor.currentHP, hawkScenario.hpBeforeFall);
equal(hawkScenario.fall.actor.position.altitudeFeet, 0);
equal(hawkScenario.duplicateFall.reason, "duplicate-fall");
equal(hawkScenario.diagnostics.filter((entry) => entry.eventType === "fall-state-completed").length, 1);
equal(hawkScenario.diagnostics.filter((entry) => entry.eventType === "prey-lifted").length, 1);
equal(hawkScenario.diagnostics.filter((entry) => entry.eventType === "prey-carried").length, 1);
equal(hawkScenario.diagnostics.filter((entry) => entry.eventType === "prey-released").length, 1);

const flightActionsSource = fs.readFileSync(
  new URL("../src/utils/flightActions.js", import.meta.url),
  "utf8",
);
const dropStart = flightActionsSource.indexOf("export function dropCarriedTarget");
const dropEnd = flightActionsSource.indexOf("export function flyToHex", dropStart);
const dropSource = flightActionsSource.slice(dropStart, dropEnd);
ok(dropSource.includes("requiresCanonicalFallAuthority: true"));
ok(dropSource.includes("fallPending: dropHeight > 0"));
equal(dropSource.includes("applyFallDamage("), false);
equal(dropSource.includes("currentHP"), false);
equal(dropSource.includes("hp:"), false);

const staleScenario = runPhase3C3AStaleCallbackScenario();
equal(staleScenario.stale.reason, "stale-carrier-callback");
equal(staleScenario.staleMovement.reason, "stale-carrier-callback");
equal(staleScenario.staleMovement.carrier.position.x, 1);
equal(staleScenario.staleMovement.passenger.position.x, 2);
ok(staleScenario.diagnostics.every((entry) => entry.eventType === "stale-carrier-callback-rejected"));

const escapeRegistry = createCanonicalCarrierRegistry();
const escapeCarrier = {
  id: "hawk:escape", actorKey: "hawk", species: "hawk", creatureType: "animal", size: "small",
  position: { x: 4, y: 4, altitudeFeet: 10 },
  flightState: { mode: "airborne", altitudeFeet: 10 },
  carrierProfile: { maximumLoad: 50, allowedRelationshipTypes: ["prey-carry"] },
};
const escapePrey = {
  id: "prey:escape", species: "rodent", creatureType: "animal", size: "tiny", weight: 4,
  position: { x: 4, y: 4, altitudeFeet: 0 }, quarryProfile: { eligible: true },
};
const escapeOwner = {
  generationId: "g:escape",
  initiativeTurnId: "g:escape:turn:1",
  actionToken: "g:escape:turn:1:action:1",
  actorId: escapeCarrier.id,
};
const escapeControl = establishPreyControl({
  carrier: escapeCarrier, passenger: escapePrey,
  controlResult: { accepted: true, carrierId: escapeCarrier.id, passengerId: escapePrey.id },
  ...escapeOwner,
});
const escapeLink = establishCanonicalCarrierLink({
  registry: escapeRegistry, carrier: escapeCarrier, passenger: escapePrey,
  relationshipType: "prey-carry", controlType: "restrained-prey",
  controlRecord: escapeControl.controlRecord, ...escapeOwner, authoritativeTurn: escapeOwner,
});
const escaped = resolvePreyStruggle({
  registry: escapeRegistry,
  linkId: escapeLink.link.linkId,
  opposedResult: { escaped: true },
  actionToken: "g:escape:turn:2:action:1",
  initiativeTurnId: "g:escape:turn:2",
  generationId: escapeOwner.generationId,
  carrier: escapeCarrier,
  passenger: escapePrey,
  landingPosition: { x: 4, y: 4, altitudeFeet: 0 },
  authoritativeTurn: {
    generationId: escapeOwner.generationId,
    initiativeTurnId: "g:escape:turn:2",
    actionToken: "g:escape:turn:2:action:1",
    actorId: escapePrey.id,
  },
  actionOwnerId: escapePrey.id,
});
equal(escaped.accepted, true);
equal(escaped.escaped, true);
equal(escapeRegistry.activeByPassenger.has(escapePrey.id), false);
equal(escaped.fallClaim.accepted, true);

console.log(`Phase 3C3A falling/prey tests passed: ${assertions}`);
