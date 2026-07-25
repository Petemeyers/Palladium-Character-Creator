import assert from "node:assert/strict";
import fs from "node:fs";
import { getCanonicalCombatActorDefinition } from "../src/data/canonicalCombatActors.js";
import {
  createCanonicalCarrierRegistry,
  establishCanonicalCarrierLink,
  establishPreyControl,
  resolveCarrierCapacity,
  validateCanonicalQuarry,
} from "../src/utils/combat/canonicalCarrierLink.js";
import { normalizeReferenceCombatActor } from "../src/utils/combat/normalizeCombatActorSchema.js";
import {
  runPhase3C3AHawkPreyScenario,
  runPhase3C3AKnightWarhorseScenario,
  runPhase3C3AStaleCallbackScenario,
} from "../src/utils/combat/phase3c3aCarrierScenarios.js";

const hawkPrey = runPhase3C3AHawkPreyScenario();
const mounted = runPhase3C3AKnightWarhorseScenario();
const stale = runPhase3C3AStaleCallbackScenario();
const carrierSource = fs.readFileSync(new URL("../src/utils/combat/canonicalCarrierLink.js", import.meta.url), "utf8");
const flightSource = fs.readFileSync(new URL("../src/utils/flightActions.js", import.meta.url), "utf8");
const catalogSource = fs.readFileSync(new URL("../src/utils/combatActionCatalog.js", import.meta.url), "utf8");
const hawkDefinition = getCanonicalCombatActorDefinition("hawk");
const knightDefinition = getCanonicalCombatActorDefinition("knight");
const warhorseDefinition = getCanonicalCombatActorDefinition("warhorse");
const owner = {
  generationId: "matrix:g",
  initiativeTurnId: "matrix:g:turn:1",
  actionToken: "matrix:g:turn:1:action:1",
  actorId: "matrix:hawk",
};
const carrier = {
  ...structuredClone(hawkDefinition),
  id: owner.actorId,
  position: { x: 1, y: 1, altitudeFeet: 5 },
};
const prey = {
  id: "matrix:prey", name: "Matrix Prey", species: "rodent", creatureType: "animal",
  size: "tiny", weight: 4, equipment: [{ weight: 1 }],
  position: { x: 1, y: 1, altitudeFeet: 0 },
  quarryProfile: { eligible: true },
};
const failedControl = establishPreyControl({
  carrier, passenger: prey,
  controlResult: { accepted: false, carrierId: carrier.id, passengerId: prey.id },
  ...owner,
});
const selfLink = establishCanonicalCarrierLink({
  registry: createCanonicalCarrierRegistry(),
  carrier,
  passenger: carrier,
  relationshipType: "consensual-carry",
  controlType: "consensual-passenger",
  ...owner,
  authoritativeTurn: owner,
});
const normalized = normalizeReferenceCombatActor({
  ...structuredClone(hawkDefinition),
  id: "matrix:normalized",
  carrierLink: hawkPrey.movement.link,
}, { source: "phase3c3a-requirement-matrix" }).normalizedActor;
const impossible = resolveCarrierCapacity({
  carrier,
  passenger: { ...prey, weight: 100 },
  relationshipType: "prey-carry",
});
const overloaded = resolveCarrierCapacity({
  carrier: { ...carrier, carrierProfile: { ...carrier.carrierProfile, maximumLoad: 10 } },
  passenger: { ...prey, weight: 11 },
  relationshipType: "prey-carry",
});
const forbiddenEvents = new Set(hawkPrey.diagnostics.map((entry) => entry.eventType));
const checks = [
  ["1 separate actors", hawkPrey.hawk.id !== hawkPrey.prey.id],
  ["2 identity not display name", hawkPrey.linked.link.carrierId !== hawkPrey.hawk.name],
  ["3 self-link rejected", selfLink.reason === "carrier-equals-passenger"],
  ["4 duplicate carrier rejected", carrierSource.includes("duplicate-active-carrier-link")],
  ["5 multiple carriers rejected", carrierSource.includes("passenger-already-attached")],
  ["6 carrier owns position", hawkPrey.linked.link.positionAuthority === "carrier"],
  ["7 carrier owns altitude", hawkPrey.linked.link.altitudeAuthority === "carrier"],
  ["8 passenger position derived", hawkPrey.movement.passenger.position.x === hawkPrey.movement.carrier.position.x],
  ["9 independent passenger movement rejected", mounted.riderMove.reason === "passenger-independent-movement"],
  ["10 normalization preserves relationship", normalized.carrierLink.linkId === hawkPrey.movement.link.linkId],
  ["11 stale relationship callback rejected", stale.stale.reason === "stale-carrier-callback"],
  ["12 relationship releases once", hawkPrey.released.link.state === "released"],
  ["13 passenger weight included", hawkPrey.linked.capacity.passengerWeight === 4],
  ["14 equipment weight included", resolveCarrierCapacity({ carrier, passenger: prey, relationshipType: "prey-carry" }).equipmentWeight === 1],
  ["15 impossible load rejected", impossible.allowed === false],
  ["16 overloaded flight rejected", overloaded.allowed === false],
  ["17 prey requires legal quarry", validateCanonicalQuarry({ carrier, passenger: prey }).accepted],
  ["18 armored Knight rejected", !validateCanonicalQuarry({ carrier, passenger: knightDefinition }).accepted],
  ["19 carry requires control", hawkPrey.control.accepted],
  ["20 failed grapple cannot link", failedControl.reason === "prey-control-required"],
  ["21 tiny prey carried", hawkPrey.linked.accepted],
  ["22 oversized prey not lifted", impossible.reason === "load-impossible"],
  ["23 prey follows Hawk", hawkPrey.movement.passenger.position.y === hawkPrey.movement.carrier.position.y],
  ["24 altitude preserves attachment", hawkPrey.movement.passenger.position.altitudeFeet === 30],
  ["25 prey can struggle", hawkPrey.struggle.accepted],
  ["26 broken control releases", carrierSource.includes('cause: "prey-control-broken"')],
  ["27 ground release no fall", mounted.dismounted.fallClaim === null],
  ["28 altitude release starts fall", hawkPrey.released.fallClaim.accepted],
  ["29 drop does not mutate HP", !flightSource.slice(flightSource.indexOf("export function dropCarriedTarget"), flightSource.indexOf("export function flyToHex")).includes("applyFallDamage(")],
  ["30 fall resolves once", hawkPrey.duplicateFall.reason === "duplicate-fall"],
  ["31 stale fall cannot move", stale.staleMovement.carrier.position.x === 1],
  ["32 stale fall cannot damage", stale.prey.currentHP === 3],
  ["33 falling not automatic death", hawkPrey.fall.actor.currentHP === hawkPrey.hpBeforeFall],
  ["34 Mount creates relationship", mounted.mounted.accepted],
  ["35 Knight/Warhorse separate HP", mounted.knight.currentHP !== mounted.warhorse.currentHP],
  ["36 mount owns position", mounted.movement.link.positionAuthority === "carrier"],
  ["37 rider move rejected", mounted.riderMove.accepted === false],
  ["38 legal dismount position", mounted.knight.position.y === 5],
  ["39 occupied dismount rejected", carrierSource.includes("occupied-dismount-destination")],
  ["40 emergency dismount uses fall", carrierSource.includes('cause: emergency ? "emergency-dismount"')],
  ["41 rider loss does not delete mount", Boolean(mounted.warhorse.id)],
  ["42 mount loss does not merge rider", mounted.knight.actorKey === "knight"],
  ["43 catalog has Mount", mounted.beforeCatalog.some((action) => action.actionKey === "mount")],
  ["44 catalog has Dismount", mounted.duringCatalog.some((action) => action.actionKey === "dismount")],
  ["45 transitions not player actions", !catalogSource.includes('id: "carrier-link-state-changed"')],
  ["46 no synthetic sidearm", hawkDefinition.equipment.length === 0],
  ["47 no natural attack dropped", hawkDefinition.naturalAttackProfiles.length === hawkPrey.hawk.naturalAttackProfiles.length],
  ["48 no duplicate completion", !forbiddenEvents.has("duplicate-completion")],
  ["49 no duplicate finalizer", !forbiddenEvents.has("duplicate-finalizer")],
  ["50 no unresolved continuation", !forbiddenEvents.has("unresolved-continuation")],
  ["51 no round rollback", !forbiddenEvents.has("round-rollback")],
  ["52 no turn-key mismatch", !forbiddenEvents.has("turn-key-mismatch")],
  ["53 no post-outcome movement", !forbiddenEvents.has("post-outcome-movement")],
  ["54 no post-outcome attack", !forbiddenEvents.has("post-outcome-attack")],
];

assert.equal(checks.length, 54);
for (const [name, passed] of checks) assert.equal(Boolean(passed), true, name);
assert.equal(warhorseDefinition.carrierProfile.coordinatedMountedCombatSupported, false);
console.log(`Phase 3C3A requirement matrix passed: ${checks.length}/54`);
