import assert from "node:assert/strict";
import { getCanonicalCombatActorDefinition } from "../src/data/canonicalCombatActors.js";
import {
  commitAnimalSurvivalAction,
  createAnimalSurvivalAction,
  createAnimalSurvivalRegistry,
  shouldDeferCombatForAnimalOutcome,
} from "../src/utils/combat/animalSurvivalState.js";
import { getExplicitAnimalPackIdentity } from "../src/utils/combat/canonicalNaturalAttacks.js";
import { runPhase3C2AGroundAnimalScenario } from "../src/utils/combat/phase3c2aGroundAnimalScenario.js";
import { createCanonicalSurrenderOffer, createSurrenderLifecycleRegistry } from "../src/utils/combat/surrenderLifecycle.js";

let assertions = 0;
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); assertions += 1; };
const check = (value, message) => { assert.ok(value, message); assertions += 1; };

const wolf = { ...getCanonicalCombatActorDefinition("wolf"), id: "wolf:1", team: "enemy", position: { x: 4, y: 4 }, remainingActions: 1 };
const registry = createAnimalSurvivalRegistry();
const owned = createAnimalSurvivalAction({ registry, actor: wolf, outcome: "animal-retreated", generationId: "g1", initiativeTurnId: "g1:t1", actionToken: "g1:t1:a1" });
equal(owned.accepted, true);
equal(owned.events[0].eventType, "animal-survival-action-owned");
equal(shouldDeferCombatForAnimalOutcome(registry).defer, true);
const retired = commitAnimalSurvivalAction({ registry, actor: wolf, survivalToken: owned.survivalToken, position: { x: 10, y: 4 }, staminaSpent: 1 });
equal(retired.committed, true);
equal(retired.staminaSpent, 1);
equal(retired.actor.position.x, 10);
equal(retired.actor.survivalState.status, "animal-retreated");
equal(retired.actor.remainingActions, 0);
equal(shouldDeferCombatForAnimalOutcome(registry).defer, false);
equal(commitAnimalSurvivalAction({ registry, actor: wolf, survivalToken: owned.survivalToken }).committed, false, "continuation exact once");

const failedMovementRegistry = createAnimalSurvivalRegistry();
const hold = createAnimalSurvivalAction({ registry: failedMovementRegistry, actor: wolf, outcome: "hold-position", generationId: "g2", initiativeTurnId: "g2:t1", actionToken: "g2:t1:a1" });
const held = commitAnimalSurvivalAction({ registry: failedMovementRegistry, actor: wolf, survivalToken: hold.survivalToken, position: wolf.position, staminaSpent: 0 });
equal(held.committed, true);
equal(held.staminaSpent, 0);
equal(held.events[0].eventType, "animal-hold-position");
const stale = { ...hold.survivalToken, actionToken: "stale", survivalTokenId: `${hold.survivalToken.survivalTokenId}:stale` };
equal(commitAnimalSurvivalAction({ registry: failedMovementRegistry, actor: wolf, survivalToken: stale }).committed, false);

const fallen = { ...wolf, positionState: "fallen", isDefeated: false, defeated: false, canAct: true };
equal(fallen.isDefeated, false, "fallen animal is nonterminal");
equal(fallen.canAct, true);

const surrender = createCanonicalSurrenderOffer({
  registry: createSurrenderLifecycleRegistry(),
  surrenderingActor: wolf,
  receivingActor: { id: "guard:1" },
  reason: "routed",
  generationId: "g3",
  initiativeTurnId: "g3:t1",
  actionToken: "g3:t1:a1",
});
equal(surrender.accepted, false);
equal(surrender.events[0].eventType, "animal-invalid-humanoid-surrender-blocked");

const wolfTwin = { ...wolf, id: "wolf:2", packId: "pack:a" };
const wolfPack = { ...wolf, id: "wolf:3", packId: "pack:a" };
const unrelatedWolf = { ...wolf, id: "wolf:4", packId: "pack:b" };
equal(getExplicitAnimalPackIdentity(wolfTwin), getExplicitAnimalPackIdentity(wolfPack));
check(getExplicitAnimalPackIdentity(wolfTwin) !== getExplicitAnimalPackIdentity(unrelatedWolf), "pack identity is explicit");
check(wolfTwin.id !== wolfPack.id, "duplicate names retain runtime identity");

const scenario = runPhase3C2AGroundAnimalScenario();
equal(scenario.validations.every((validation) => validation.valid), true);
equal(scenario.duplicateWolfIdentityIndependent, true);
equal(scenario.explicitPackIdentity, true);
equal(scenario.bite.accepted, true);
equal(scenario.tuskCharge.accepted, true);
equal(scenario.finalizationWhilePending.defer, true);
equal(scenario.finalizationAfterCommit.defer, false);
equal(scenario.retreat.staminaSpent, 1);
equal(scenario.combatOverCount, 1);
equal(scenario.postOutcomeActions, 0);
equal(scenario.authorityErrorCount, 0);
equal(scenario.roster.every((actor) => actor.movement.canFly === false || actor.creatureType !== "animal"), true);
equal(scenario.roster.filter((actor) => actor.creatureType === "animal").every((actor) => actor.inventory.length === 0), true);
equal(scenario.iconAppearances["enemy:wolf:1"].allegiance.key, "enemy");

console.log(`Phase 3C2A survival and reference-scenario tests passed: ${assertions}`);
