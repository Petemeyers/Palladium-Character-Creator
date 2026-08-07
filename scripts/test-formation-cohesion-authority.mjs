import assert from "node:assert/strict";
import {
  applyFormationDisruption,
  FORMATION_COHESION_STATES,
  resolveSpatialFormationSupport,
} from "../src/utils/combat/formationCohesionAuthority.js";

const pike = { id: "weapon.pike", name: "Pike", reachFeet: 15, handsRequired: 2, twoHanded: true, formationDependent: true };
const spear = { id: "weapon.spear", name: "Spear", reachFeet: 10, handsRequired: 2, twoHanded: true };
const sword = { id: "weapon.arming-sword", name: "Arming Sword", reachFeet: 5, handsRequired: 1 };
const actors = [
  { id: "p1", team: "party", selectedAttack: pike, training: { formationDrill: 3 }, statusEffects: [] },
  { id: "p2", team: "party", selectedAttack: spear, training: { formationDrill: 2 }, statusEffects: [] },
  { id: "p3", team: "party", selectedAttack: spear, training: { formationDrill: 2 }, statusEffects: [] },
  { id: "e1", team: "enemy", selectedAttack: sword, statusEffects: [] },
];
const positions = {
  p1: { x: 0, y: 0 },
  p2: { x: 0, y: 1 },
  p3: { x: 0, y: -1 },
  e1: { x: 4, y: 0 },
};
const distance = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2) * 5;
const getWeapon = (actor) => actor.selectedAttack;

const supported = resolveSpatialFormationSupport({
  actor: actors[0],
  target: actors[3],
  combatants: actors,
  positions,
  getWeapon,
  calculateDistanceFeet: distance,
  currentRound: 2,
});
assert.equal(supported.formationSupported, true);
assert.equal(supported.state, FORMATION_COHESION_STATES.ORDERED_LINE);
assert.equal(supported.supportBonus, 2);
assert.deepEqual(new Set(supported.supporterIds), new Set(["p2", "p3"]));

const isolated = resolveSpatialFormationSupport({
  actor: actors[0],
  target: actors[3],
  combatants: actors,
  positions: { ...positions, p2: { x: 0, y: 3 }, p3: { x: 0, y: -3 } },
  getWeapon,
  calculateDistanceFeet: distance,
  currentRound: 2,
});
assert.equal(isolated.formationSupported, false);
assert.equal(isolated.state, FORMATION_COHESION_STATES.ISOLATED);

const disruptedActor = applyFormationDisruption(actors[0], {
  sourceActorId: "e1",
  currentRound: 2,
});
const disrupted = resolveSpatialFormationSupport({
  actor: disruptedActor,
  target: actors[3],
  combatants: [disruptedActor, ...actors.slice(1)],
  positions,
  getWeapon,
  calculateDistanceFeet: distance,
  currentRound: 2,
});
assert.equal(disrupted.formationSupported, false);
assert.equal(disrupted.state, FORMATION_COHESION_STATES.DISRUPTED);
console.log("formation cohesion authority test passed");
