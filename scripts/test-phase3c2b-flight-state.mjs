import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CANONICAL_FLYING_ANIMAL_KEYS,
  getCanonicalCombatActorDefinition,
} from "../src/data/canonicalCombatActors.js";
import { normalizeReferenceCombatActor } from "../src/utils/combat/normalizeCombatActorSchema.js";
import { validateCombatActor } from "../src/utils/combat/validateCombatActor.js";
import {
  createCanonicalFlightState,
  createFlightAuthorityRegistry,
  getAltitudeBand,
  normalizeCanonicalFlightState,
  resolveFlightTransition,
} from "../src/utils/combat/canonicalFlightState.js";

let assertions = 0;
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); assertions += 1; };
const check = (value, message) => { assert.ok(value, message); assertions += 1; };

const hawkDefinition = getCanonicalCombatActorDefinition("hawk");
const falconDefinition = getCanonicalCombatActorDefinition("falcon");
equal(hawkDefinition.actorKey, "hawk", "Hawk stable key");
equal(falconDefinition.actorKey, "falcon", "Falcon stable key");
equal(hawkDefinition.combatActorSchemaVersion, 1);
equal(falconDefinition.combatActorSchemaVersion, 1);
check(hawkDefinition.actorKey !== falconDefinition.actorKey, "flyers remain distinct");
check(CANONICAL_FLYING_ANIMAL_KEYS.includes("hawk") && CANONICAL_FLYING_ANIMAL_KEYS.includes("falcon"));
equal(hawkDefinition.anatomyProfile.wingsPresent, true);
equal(falconDefinition.anatomyProfile.wingCount, 2);
equal(hawkDefinition.anatomyProfile.talonsPresent, true);
equal(hawkDefinition.flightProfile.magicalFlight, false);
equal(hawkDefinition.flightProfile.mountedFlight, false);
equal(hawkDefinition.flightProfile.swoopProfile, null);

const renamed = normalizeReferenceCombatActor({ ...hawkDefinition, id: "bird:renamed", name: "Not Identity", team: "enemy" }).normalizedActor;
equal(renamed.actorKey, "hawk", "display name is not identity");
const duplicate = normalizeReferenceCombatActor({ ...hawkDefinition, id: "hawk:2", team: "enemy" }).normalizedActor;
check(renamed.id !== duplicate.id, "duplicate Hawks preserve runtime identity");
equal(renamed.species, "hawk");
equal(duplicate.flightState.mode, "airborne");
equal(duplicate.flightState.altitudeFeet, 20);
equal(duplicate.position.altitudeFeet, 20);
equal(getAltitudeBand(0), "ground");
equal(getAltitudeBand(10), "low");
equal(getAltitudeBand(30), "medium");
equal(getAltitudeBand(31), "high");

const legacy = normalizeCanonicalFlightState({
  ...hawkDefinition,
  id: "legacy:hawk",
  flightState: undefined,
  isFlying: true,
  altitudeFeet: 15,
  position: { x: 1, y: 2 },
});
equal(legacy.flightState.mode, "airborne");
equal(legacy.flightState.altitudeFeet, 15);
equal(legacy.actor.position.altitudeFeet, 15);
equal(legacy.actor.flightCompatibilityProjection, true);

const registry = createFlightAuthorityRegistry();
const groundHawk = normalizeCanonicalFlightState({
  ...hawkDefinition,
  id: "hawk:ground",
  currentHP: 5,
  flightState: createCanonicalFlightState({ mode: "grounded", altitudeFeet: 0, horizontalPosition: { x: 1, y: 1 } }),
  position: { x: 1, y: 1, altitudeFeet: 0 },
}).actor;
const owner = { generationId: "g1", initiativeTurnId: "g1:r1:hawk", actionToken: "g1:r1:hawk:a1", actorId: groundHawk.id };
const noToken = resolveFlightTransition({ actor: groundHawk, requestedTransition: "takeoff", destination: { x: 1, y: 1, altitudeFeet: 5 }, registry });
equal(noToken.accepted, false);
equal(noToken.staminaSpent, 0);
const blocked = resolveFlightTransition({ actor: groundHawk, requestedTransition: "takeoff", destination: { x: 1, y: 1, altitudeFeet: 5 }, ...owner, authoritativeTurn: owner, movementSequence: 1, takeoffBlocked: true, staminaCost: 1, registry });
equal(blocked.reason, "blocked-takeoff");
equal(blocked.staminaSpent, 0);
const takeoff = resolveFlightTransition({ actor: groundHawk, requestedTransition: "takeoff", destination: { x: 1, y: 1, altitudeFeet: 5 }, ...owner, authoritativeTurn: owner, movementSequence: 1, staminaCost: 1, staminaAvailable: 8, registry });
equal(takeoff.accepted, true);
equal(takeoff.flightState.mode, "airborne");
equal(takeoff.flightState.altitudeFeet, takeoff.position.altitudeFeet);
equal(takeoff.staminaSpent, 1);
equal(takeoff.events.filter((event) => event.eventType === "flight-position-committed").length, 1);
const duplicateTransition = resolveFlightTransition({ actor: takeoff.actor, requestedTransition: "ascend", destination: { x: 1, y: 1, altitudeFeet: 10 }, ...owner, authoritativeTurn: owner, movementSequence: 1, registry });
equal(duplicateTransition.accepted, false);
equal(duplicateTransition.reason, "duplicate-flight-transition");
const staleOwner = { ...owner, actionToken: "stale" };
const stale = resolveFlightTransition({ actor: takeoff.actor, requestedTransition: "ascend", destination: { x: 1, y: 1, altitudeFeet: 10 }, ...staleOwner, authoritativeTurn: owner, movementSequence: 2, registry });
equal(stale.reason, "stale-action-token");
equal(stale.actor.flightState.altitudeFeet, 5);
const ceiling = resolveFlightTransition({ actor: takeoff.actor, requestedTransition: "ascend", destination: { x: 1, y: 1, altitudeFeet: 20 }, ...{ ...owner, actionToken: "g1:r1:hawk:a2" }, authoritativeTurn: { ...owner, actionToken: "g1:r1:hawk:a2" }, movementSequence: 2, ceilingHeightFeet: 15, registry });
equal(ceiling.accepted, false);
equal(ceiling.staminaSpent, 0);

const invalidAltitude = validateCombatActor({
  ...hawkDefinition,
  id: "hawk:invalid",
  team: "enemy",
  flightState: { ...hawkDefinition.flightState, altitudeFeet: -1, altitudeBand: "ground" },
}, { normalize: false });
check(invalidAltitude.errors.some((error) => error.code === "negative-altitude"));
const midFlightNormalization = normalizeReferenceCombatActor(groundHawk, { lifecyclePhase: "flight-movement" });
equal(midFlightNormalization.blocked, true);
equal(midFlightNormalization.normalizedActor, groundHawk);

const adapterSource = fs.readFileSync(new URL("../src/utils/selectableActorAdapter.js", import.meta.url), "utf8");
check(adapterSource.includes("normalizeCanonicalFlightState"), "adapter uses canonical flight normalization");
check(!adapterSource.includes("aiFlightState:"), "adapter no longer constructs AI-local flight authority");

console.log(`Phase 3C2B flight-state tests passed: ${assertions}`);
