import assert from "node:assert/strict";
import {
  commitCanonicalCarrierMovement,
  createCanonicalCarrierRegistry,
  deriveCanonicalPassengerPosition,
  establishCanonicalCarrierLink,
  establishPreyControl,
  registerCanonicalCarrierSchedule,
  rejectIndependentPassengerMovement,
  releaseCanonicalCarrierLink,
  resolveCarrierCapacity,
  validateCanonicalCarrierRelationships,
  validateCanonicalCarrierSchedule,
  validateCanonicalQuarry,
} from "../src/utils/combat/canonicalCarrierLink.js";
import { normalizeReferenceCombatActor } from "../src/utils/combat/normalizeCombatActorSchema.js";

let assertions = 0;
const equal = (...args) => { assertions++; assert.equal(...args); };
const ok = (...args) => { assertions++; assert.ok(...args); };

const owner = {
  generationId: "g:carrier",
  initiativeTurnId: "g:carrier:turn:1",
  actionToken: "g:carrier:turn:1:action:1",
  actorId: "hawk:1",
};
const hawk = {
  id: "hawk:1", actorKey: "hawk", name: "Hawk", species: "hawk",
  creatureType: "animal", size: "small", position: { x: 2, y: 3, altitudeFeet: 10 },
  flightState: { mode: "airborne", altitudeFeet: 10 },
  carrierProfile: { maximumLoad: 50, allowedRelationshipTypes: ["prey-carry"] },
};
const prey = {
  id: "prey:1", actorKey: "fixture-prey", name: "Prey", species: "rodent",
  creatureType: "animal", size: "tiny", weight: 4, equipment: [{ weight: 1 }],
  position: { x: 2, y: 3, altitudeFeet: 0 }, quarryProfile: { eligible: true },
};
const registry = createCanonicalCarrierRegistry();
const control = establishPreyControl({
  carrier: hawk,
  passenger: prey,
  controlResult: { accepted: true, carrierId: hawk.id, passengerId: prey.id },
  ...owner,
});
equal(control.accepted, true, "legal quarry and successful existing grapple control are admitted");
equal(control.events[0].eventType, "prey-control-established");
const link = establishCanonicalCarrierLink({
  registry, carrier: hawk, passenger: prey, relationshipType: "prey-carry",
  controlType: "restrained-prey", controlRecord: control.controlRecord,
  ...owner, authoritativeTurn: owner,
});
equal(link.accepted, true);
equal(link.link.carrierId, hawk.id);
equal(link.link.passengerId, prey.id);
ok(link.link.carrierId !== link.link.passengerId, "carrier and passenger remain distinct");
equal(link.link.positionAuthority, "carrier");
equal(link.link.altitudeAuthority, "carrier");
equal(link.capacity.passengerWeight, 4);
equal(link.capacity.equipmentWeight, 1);
equal(link.capacity.totalLoad, 5);
equal(link.capacity.capacityState, "trivial");

const derived = deriveCanonicalPassengerPosition({ link: link.link, carrier: hawk });
equal(derived.position.x, hawk.position.x);
equal(derived.position.y, hawk.position.y);
equal(derived.position.altitudeFeet, 10);
equal(derived.events[0].eventType, "passenger-position-derived");

const independent = rejectIndependentPassengerMovement({
  registry, passenger: prey, requestedPosition: { x: 20, y: 20, altitudeFeet: 0 },
});
equal(independent.accepted, false);
equal(independent.reason, "passenger-independent-movement");
equal(independent.events[0].eventType, "passenger-independent-movement-rejected");

const duplicate = establishCanonicalCarrierLink({
  registry, carrier: hawk, passenger: { ...prey, id: "prey:2" },
  relationshipType: "prey-carry", controlType: "restrained-prey",
  controlRecord: { ...control.controlRecord, passengerId: "prey:2" },
  ...owner, authoritativeTurn: owner,
});
equal(duplicate.accepted, false);
equal(duplicate.reason, "duplicate-active-carrier-link");

const secondCarrier = { ...hawk, id: "hawk:2" };
const passengerDuplicate = establishCanonicalCarrierLink({
  registry, carrier: secondCarrier, passenger: prey,
  relationshipType: "prey-carry", controlType: "restrained-prey",
  controlRecord: { ...control.controlRecord, carrierId: secondCarrier.id },
  ...owner, actorId: secondCarrier.id,
  authoritativeTurn: { ...owner, actorId: secondCarrier.id },
});
equal(passengerDuplicate.accepted, false);
equal(passengerDuplicate.reason, "passenger-already-attached");

const selfRegistry = createCanonicalCarrierRegistry();
const self = establishCanonicalCarrierLink({
  registry: selfRegistry, carrier: hawk, passenger: hawk,
  relationshipType: "consensual-carry", controlType: "consensual-passenger",
  ...owner, authoritativeTurn: owner,
});
equal(self.reason, "carrier-equals-passenger");

const capacity = resolveCarrierCapacity({
  carrier: hawk,
  passenger: { ...prey, weight: 25 },
  passengerEquipment: [{ weight: 10 }],
  relationshipType: "prey-carry",
});
equal(capacity.passengerWeight, 25);
equal(capacity.equipmentWeight, 10);
equal(capacity.totalLoad, 35);
equal(capacity.allowed, true);
const impossible = resolveCarrierCapacity({
  carrier: hawk,
  passenger: { ...prey, weight: 80 },
  relationshipType: "prey-carry",
});
equal(impossible.allowed, false);
ok(["carrier-overloaded", "load-impossible"].includes(impossible.reason));

const armoredKnight = {
  id: "knight:1", actorKey: "knight", species: "human", creatureType: "humanoid",
  size: "medium", equippedArmor: { name: "Plate Harness" },
};
equal(validateCanonicalQuarry({ carrier: hawk, passenger: armoredKnight }).accepted, false);
equal(validateCanonicalQuarry({ carrier: hawk, passenger: armoredKnight }).reason, "armored-target-not-ordinary-quarry");
equal(establishPreyControl({
  carrier: hawk, passenger: prey,
  controlResult: { accepted: false, carrierId: hawk.id, passengerId: prey.id },
  ...owner,
}).reason, "prey-control-required");

const movementOwner = {
  generationId: owner.generationId,
  initiativeTurnId: "g:carrier:turn:2",
  actionToken: "g:carrier:turn:2:action:1",
  actorId: hawk.id,
};
const movement = commitCanonicalCarrierMovement({
  registry, linkId: link.link.linkId, carrier: hawk, passenger: prey,
  destination: { x: 7, y: 8, altitudeFeet: 20 },
  ...movementOwner, authoritativeTurn: movementOwner,
});
equal(movement.accepted, true);
equal(movement.carrier.position.x, 7);
equal(movement.passenger.position.x, 7);
equal(movement.passenger.position.altitudeFeet, 20);

const schedule = registerCanonicalCarrierSchedule({
  registry, scheduleId: "carry:schedule:1", scheduleKind: "carrier-movement",
  ownerId: link.link.linkId, ...movementOwner,
});
equal(schedule.accepted, true);
equal(validateCanonicalCarrierSchedule({
  registry, scheduleId: schedule.schedule.scheduleId, ...movementOwner,
}).accepted, true);
const stale = validateCanonicalCarrierSchedule({
  registry, scheduleId: schedule.schedule.scheduleId,
  ...movementOwner, generationId: "g:new",
});
equal(stale.accepted, false);
equal(stale.events[0].eventType, "stale-carrier-callback-rejected");
equal(stale.schedule.state, "canceled");
equal(stale.schedule.cancellationReason, "generation-changed");

const staleMovement = commitCanonicalCarrierMovement({
  registry, linkId: link.link.linkId, carrier: movement.carrier, passenger: movement.passenger,
  destination: { x: 99, y: 99, altitudeFeet: 99 },
  ...movementOwner, generationId: "g:new",
  authoritativeTurn: { ...movementOwner, generationId: "g:new" },
});
equal(staleMovement.accepted, false);
equal(staleMovement.carrier.position.x, 7);
equal(staleMovement.passenger.position.x, 7);

const normalized = normalizeReferenceCombatActor({
  ...movement.passenger,
  actorKey: "hawk",
  id: "normalized:hawk",
  carrierLink: movement.link,
}, { source: "phase3c3a-test" }).normalizedActor;
equal(normalized.carrierLink.linkId, movement.link.linkId);

const relationships = validateCanonicalCarrierRelationships({
  registry, actors: [movement.carrier, movement.passenger],
});
equal(relationships.valid, true);
equal(relationships.diagnostics.length, 0);

const releaseOwner = {
  generationId: owner.generationId,
  initiativeTurnId: "g:carrier:turn:3",
  actionToken: "g:carrier:turn:3:action:1",
};
const released = releaseCanonicalCarrierLink({
  registry, linkId: link.link.linkId, carrier: movement.carrier, passenger: movement.passenger,
  ...releaseOwner, landingPosition: { x: 7, y: 8, altitudeFeet: 0 },
  authoritativeTurn: { ...releaseOwner, actorId: movement.carrier.id },
});
equal(released.accepted, true);
equal(registry.activeByCarrier.size, 0);
equal(registry.activeByPassenger.size, 0);
equal(released.fallClaim.accepted, true);
const duplicateRelease = releaseCanonicalCarrierLink({
  registry, linkId: link.link.linkId, carrier: movement.carrier, passenger: movement.passenger,
  ...releaseOwner,
  authoritativeTurn: { ...releaseOwner, actorId: movement.carrier.id },
});
equal(duplicateRelease.reason, "duplicate-release");

console.log(`Phase 3C3A carrier-authority tests passed: ${assertions}`);
