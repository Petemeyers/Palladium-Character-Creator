import assert from "node:assert/strict";
import { getCanonicalCombatActorDefinition } from "../src/data/canonicalCombatActors.js";
import { getCombatActionContract } from "../src/utils/combatActionCatalog.js";
import {
  createCanonicalCarrierRegistry,
  executeCanonicalDismountAction,
  executeCanonicalMountAction,
  resolveCarrierCapacity,
} from "../src/utils/combat/canonicalCarrierLink.js";
import { runPhase3C3AKnightWarhorseScenario } from "../src/utils/combat/phase3c3aCarrierScenarios.js";

let assertions = 0;
const equal = (...args) => { assertions++; assert.equal(...args); };
const ok = (...args) => { assertions++; assert.ok(...args); };

const scenario = runPhase3C3AKnightWarhorseScenario();
equal(scenario.separateIdentity, true);
equal(scenario.mounted.accepted, true);
equal(scenario.mounted.link.relationshipType, "mounted");
equal(scenario.mounted.link.controlType, "rider-controlled");
equal(scenario.mounted.link.positionAuthority, "carrier");
equal(scenario.mounted.link.altitudeAuthority, "carrier");
equal(scenario.movement.accepted, true);
equal(scenario.movement.carrier.position.x, 9);
equal(scenario.movement.passenger.position.x, 9);
equal(scenario.movement.carrier.position.y, 4);
equal(scenario.movement.passenger.position.y, 4);
equal(scenario.riderMove.accepted, false);
equal(scenario.riderMove.reason, "passenger-independent-movement");
equal(scenario.dismounted.accepted, true);
equal(scenario.dismounted.passenger.position.y, 5);
equal(scenario.dismounted.carrier.position.y, 4);
equal(scenario.knight.currentHP, 24);
equal(scenario.warhorse.currentHP, 30);
ok(scenario.knight.combatStamina !== scenario.warhorse.combatStamina);
equal(scenario.knight.actorKey, "knight");
equal(scenario.warhorse.actorKey, "warhorse");

const mountAction = scenario.beforeCatalog.find((entry) => entry.actionKey === "mount");
equal(Boolean(mountAction), true);
equal(mountAction.displayLabel, "Mount");
equal(mountAction.category, "Carrier");
equal(mountAction.executorIdentity, "canonical-carrier-executor");
equal(mountAction.costActions, 1);
equal(mountAction.turnEnding, true);
equal(mountAction.rollRequired, false);
equal(mountAction.aiAvailable, true);
equal(mountAction.playerVisible, true);
const dismountAction = scenario.duringCatalog.find((entry) => entry.actionKey === "dismount");
equal(Boolean(dismountAction), true);
equal(dismountAction.displayLabel, "Dismount");
equal(dismountAction.executorIdentity, "canonical-carrier-executor");
equal(dismountAction.turnEnding, true);
equal(scenario.duringCatalog.some((entry) => entry.actionKey === "carrier-link-state-changed"), false);
equal(getCombatActionContract("mount").executorIdentity, "canonical-carrier-executor");
equal(getCombatActionContract("dismount").rollRequired, false);

const knight = structuredClone(getCanonicalCombatActorDefinition("knight"));
const warhorse = structuredClone(getCanonicalCombatActorDefinition("warhorse"));
equal(warhorse.carrierProfile.maximumLoad, 300);
equal(warhorse.carrierProfile.coordinatedMountedCombatSupported, false);
equal(knight.passengerProfile.mountFoundationOnly, true);
equal(warhorse.survivalProfile.mountedCombatSupported, false);
equal(warhorse.armorProfile.barding, false);
const capacity = resolveCarrierCapacity({
  carrier: warhorse,
  passenger: knight,
  relationshipType: "mounted",
});
equal(capacity.allowed, true);
equal(capacity.passengerWeight, 150);
equal(capacity.equipmentWeight, 53);
equal(capacity.totalLoad, 203);
equal(capacity.maximumLoad, 300);

const occupiedRegistry = createCanonicalCarrierRegistry();
const mountOwner = {
  generationId: "g:occupied",
  initiativeTurnId: "g:occupied:turn:1",
  actionToken: "g:occupied:turn:1:action:1",
  actorId: "rider:occupied",
};
const rider = { ...knight, id: "rider:occupied", position: { x: 0, y: 0, altitudeFeet: 0 } };
const mount = { ...warhorse, id: "mount:occupied", position: { x: 0, y: 0, altitudeFeet: 0 } };
const mounted = executeCanonicalMountAction({
  registry: occupiedRegistry, rider, mount, ...mountOwner, authoritativeTurn: mountOwner,
});
equal(mounted.accepted, true);
const blocked = executeCanonicalDismountAction({
  registry: occupiedRegistry,
  linkId: mounted.link.linkId,
  rider,
  mount,
  generationId: mountOwner.generationId,
  initiativeTurnId: "g:occupied:turn:2",
  actionToken: "g:occupied:turn:2:action:1",
  destination: { x: 1, y: 0, altitudeFeet: 0 },
  occupied: true,
  authoritativeTurn: {
    generationId: mountOwner.generationId,
    initiativeTurnId: "g:occupied:turn:2",
    actionToken: "g:occupied:turn:2:action:1",
    actorId: rider.id,
  },
});
equal(blocked.accepted, false);
equal(blocked.reason, "occupied-dismount-destination");
equal(occupiedRegistry.activeByPassenger.get(rider.id), mounted.link.linkId);

const emergency = executeCanonicalDismountAction({
  registry: occupiedRegistry,
  linkId: mounted.link.linkId,
  rider,
  mount,
  generationId: mountOwner.generationId,
  initiativeTurnId: "g:occupied:turn:2",
  actionToken: "g:occupied:turn:2:action:2",
  destination: { x: 1, y: 0, altitudeFeet: 0 },
  emergency: true,
  authoritativeTurn: {
    generationId: mountOwner.generationId,
    initiativeTurnId: "g:occupied:turn:2",
    actionToken: "g:occupied:turn:2:action:2",
    actorId: rider.id,
  },
});
equal(emergency.accepted, true);
equal(emergency.fallClaim.accepted, true);
equal(emergency.fallClaim.fallState.cause, "emergency-dismount");
equal(emergency.passenger.currentHP, rider.currentHP);
equal(emergency.carrier.currentHP, mount.currentHP);

console.log(`Phase 3C3A mount-foundation tests passed: ${assertions}`);
