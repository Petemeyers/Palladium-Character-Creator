import assert from "node:assert/strict";
import fs from "node:fs";
import { getCanonicalCombatActorDefinition } from "../src/data/canonicalCombatActors.js";
import {
  createCanonicalFlightState,
  createFlightAuthorityRegistry,
  getCanonicalFlightPresentation,
  resolveCanonicalFall,
  resolveFlightTransition,
} from "../src/utils/combat/canonicalFlightState.js";
import {
  commitAnimalSurvivalAction,
  createAnimalSurvivalAction,
  createAnimalSurvivalRegistry,
  shouldDeferCombatForAnimalOutcome,
} from "../src/utils/combat/animalSurvivalState.js";
import {
  runPhase3C2BFlyingAnimalScenario,
  runPhase3C2BIndependentFlyerScenario,
} from "../src/utils/combat/phase3c2bFlyingAnimalScenario.js";
import { worldVectorFromEntity } from "../src/utils/hexGridMath.js";

let assertions = 0;
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); assertions += 1; };
const check = (value, message) => { assert.ok(value, message); assertions += 1; };

const hawk = {
  ...getCanonicalCombatActorDefinition("hawk"),
  id: "hawk:fall",
  currentHP: 5,
  HP: 5,
  position: { x: 2, y: 2, altitudeFeet: 20 },
  flightState: createCanonicalFlightState({
    mode: "falling",
    altitudeFeet: 20,
    horizontalPosition: { x: 2, y: 2 },
    verticalVelocity: -10,
    lastCommittedActionToken: "g3:r1:hawk:a1",
    lastCommittedInitiativeTurnId: "g3:r1:hawk",
  }),
};
const registry = createFlightAuthorityRegistry();
const fall = resolveCanonicalFall({ actor: hawk, fallToken: "fall:1", actionToken: "g3:r1:hawk:a1", initiativeTurnId: "g3:r1:hawk", generationId: "g3", registry });
equal(fall.accepted, true);
equal(fall.actor.flightState.mode, "grounded");
equal(fall.actor.position.altitudeFeet, 0);
equal(fall.actor.currentHP, 5);
equal(fall.damage, 0);
equal(fall.events[0].eventType, "falling-started");
equal(fall.events.at(-1).eventType, "falling-completed");
const duplicate = resolveCanonicalFall({ actor: fall.actor, fallToken: "fall:1", actionToken: "g3:r1:hawk:a1", initiativeTurnId: "g3:r1:hawk", generationId: "g3", registry });
equal(duplicate.accepted, false);
equal(duplicate.reason, "duplicate-fall-completion");
const stale = resolveCanonicalFall({ actor: hawk, fallToken: "fall:2", actionToken: "stale", initiativeTurnId: "g3:r2:hawk", generationId: "g3", registry });
equal(stale.accepted, false);
equal(stale.reason, "stale-fall-callback");
equal(stale.actor.position.altitudeFeet, 20);

const grappleFall = resolveFlightTransition({
  actor: { ...hawk, grappleState: { opponent: "guard:1" }, flightState: createCanonicalFlightState({ mode: "airborne", altitudeFeet: 20, horizontalPosition: { x: 2, y: 2 } }) },
  requestedTransition: "fall",
  destination: { x: 2, y: 2, altitudeFeet: 20 },
  generationId: "g4",
  initiativeTurnId: "g4:r1:hawk",
  actionToken: "g4:r1:hawk:a1",
  movementSequence: 1,
  authoritativeTurn: { generationId: "g4", initiativeTurnId: "g4:r1:hawk", actionToken: "g4:r1:hawk:a1", actorId: hawk.id },
  registry: createFlightAuthorityRegistry(),
});
equal(grappleFall.accepted, true);
equal(grappleFall.flightState.mode, "falling");

const survivalRegistry = createAnimalSurvivalRegistry();
const survival = createAnimalSurvivalAction({
  registry: survivalRegistry,
  actor: hawk,
  outcome: "flee-by-air",
  generationId: "g5",
  initiativeTurnId: "g5:r1:hawk",
  actionToken: "g5:r1:hawk:a1",
});
equal(survival.accepted, true);
equal(survival.events[0].eventType, "flying-animal-survival-owned");
equal(shouldDeferCombatForAnimalOutcome(survivalRegistry).defer, true);
const retreat = commitAnimalSurvivalAction({ registry: survivalRegistry, actor: hawk, survivalToken: survival.survivalToken, position: { x: 12, y: 2, altitudeFeet: 20 }, staminaSpent: 1 });
equal(retreat.committed, true);
equal(retreat.staminaSpent, 1);
equal(retreat.events[0].eventType, "flying-animal-retreated");
equal(shouldDeferCombatForAnimalOutcome(survivalRegistry).defer, false);
const capturedRegistry = createAnimalSurvivalRegistry();
const capturedAction = createAnimalSurvivalAction({ registry: capturedRegistry, actor: hawk, outcome: "animal-captured", generationId: "g6", initiativeTurnId: "g6:r1", actionToken: "g6:r1:a1" });
const captured = commitAnimalSurvivalAction({ registry: capturedRegistry, actor: hawk, survivalToken: capturedAction.survivalToken });
equal(captured.actor.id, hawk.id);
equal(captured.actor.isCaptured, true);

const presentation = getCanonicalFlightPresentation(hawk);
equal(presentation.compactMarker, "↑20");
equal(presentation.mode, "falling");
equal(presentation.modelElevationFeet, 20);
check(presentation.accessibilityLabel.includes("hawk"));
check(presentation.accessibilityLabel.includes("Talon Rake"));
const world = worldVectorFromEntity({ q: 0, r: 0, altitudeFeet: 999, flightState: createCanonicalFlightState({ mode: "airborne", altitudeFeet: 20 }) });
check(world.y < 10, "3D elevation prefers canonical altitude over stale projection");

const scenario = runPhase3C2BFlyingAnimalScenario();
equal(scenario.takeoff.accepted, true);
equal(scenario.movement.accepted, true);
equal(scenario.attackGeometry.accepted, true);
equal(scenario.impact.bodilyDamagePermitted, false);
equal(scenario.retreat.committed, true);
equal(scenario.finalizationWhilePending.defer, true);
equal(scenario.finalizationAfterCommit.defer, false);
equal(scenario.validations.every((result) => result.valid), true);
equal(scenario.combatOverCount, 1);
equal(scenario.postOutcomeActions, 0);
equal(scenario.authorityErrorCount, 0);
const independent = runPhase3C2BIndependentFlyerScenario();
equal(independent.independentIdentity, true);
equal(independent.falconLanding.accepted, true);
equal(independent.falcon.flightState.altitudeFeet, 0);
equal(independent.stale.accepted, false);
equal(independent.roundRollbackBlocked, true);

const tacticalMapSource = fs.readFileSync(new URL("../src/components/TacticalMap.jsx", import.meta.url), "utf8");
check(tacticalMapSource.includes("getCanonicalFlightPresentation"), "2D derives canonical flight presentation");
check(tacticalMapSource.includes("flightPresentation.compactMarker"), "2D uses compact altitude marker");
const threeSource = fs.readFileSync(new URL("../src/utils/three/HexArena.js", import.meta.url), "utf8");
check(threeSource.includes("fighter.flightState?.altitudeFeet"), "3D derives canonical altitude");

console.log(`Phase 3C2B falling/survival/presentation tests passed: ${assertions}`);
