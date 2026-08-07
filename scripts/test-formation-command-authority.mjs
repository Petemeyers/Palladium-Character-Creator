import assert from "node:assert/strict";
import {
  applyFormationDisruption,
  resolveSpatialFormationSupport,
} from "../src/utils/combat/formationCohesionAuthority.js";
import {
  FORMATION_COMMANDS,
  getFormationCommandOptions,
  resolveFormationCommand,
} from "../src/utils/combat/formationCommandAuthority.js";

const spear = { id: "spear", name: "Two-Handed Spear", reachFeet: 10, twoHanded: true };
const sword = { id: "sword", name: "Arming Sword", reachFeet: 5 };
const actors = [
  { id: "a", team: "party", selectedAttack: spear, training: { formationDrill: 3 }, attributes: { discipline: 14 }, proficiencyBonus: 2, statusEffects: [] },
  { id: "b", team: "party", selectedAttack: spear, training: { formationDrill: 2 }, statusEffects: [] },
  { id: "c", team: "party", selectedAttack: spear, training: { formationDrill: 2 }, statusEffects: [] },
  { id: "e", team: "enemy", selectedAttack: sword, statusEffects: [] },
];
const positions = { a: { x: 0, y: 0, facing: 0 }, b: { x: 0, y: 1 }, c: { x: 0, y: -1 }, e: { x: 4, y: 0 } };
const distance = (left, right) => Math.hypot(left.x - right.x, left.y - right.y) * 5;
const getWeapon = (actor) => actor.selectedAttack;

const disruptedActor = applyFormationDisruption(actors[0], { sourceActorId: "e", currentRound: 2 });
assert.equal(disruptedActor.formationState.recoveryRequired, true);
const options = getFormationCommandOptions({
  actor: disruptedActor,
  target: actors[3],
  combatants: [disruptedActor, ...actors.slice(1)],
  positions,
  getWeapon,
  calculateDistanceFeet: distance,
  currentRound: 5,
});
assert.ok(options.some((option) => option.id === FORMATION_COMMANDS.REFORM_LINE));
assert.ok(options.some((option) => option.id === FORMATION_COMMANDS.RALLY_FORMATION));

const reformed = resolveFormationCommand({
  commandId: FORMATION_COMMANDS.REFORM_LINE,
  actor: disruptedActor,
  target: actors[3],
  combatants: [disruptedActor, ...actors.slice(1)],
  positions,
  getWeapon,
  calculateDistanceFeet: distance,
  currentRound: 5,
});
assert.equal(reformed.accepted, true);
assert.equal(reformed.updatedActor.formationState.recoveryRequired, false);
assert.equal(reformed.updatedActor.statusEffects.some((status) => status.type === "formation-disrupted"), false);

const rallied = resolveFormationCommand({
  commandId: FORMATION_COMMANDS.RALLY_FORMATION,
  actor: disruptedActor,
  target: actors[3],
  combatants: [disruptedActor, ...actors.slice(1)],
  positions,
  getWeapon,
  calculateDistanceFeet: distance,
  currentRound: 5,
  roll: 20,
  terrainContext: { cohesionModifier: 0, flanked: false, rearPressure: false },
});
assert.equal(rallied.success, true);
assert.equal(rallied.updatedActor.formationState.recoveryRequired, false);

const supported = resolveSpatialFormationSupport({
  actor: actors[0],
  target: actors[3],
  combatants: actors,
  positions,
  getWeapon,
  calculateDistanceFeet: distance,
});
const anchored = resolveFormationCommand({
  commandId: FORMATION_COMMANDS.ANCHOR_POSITION,
  actor: actors[0],
  target: actors[3],
  combatants: actors,
  positions,
  getWeapon,
  calculateDistanceFeet: distance,
});
assert.equal(supported.formationSupported, true);
assert.equal(anchored.updatedActor.formationState.anchored, true);
assert.equal(anchored.controlModifier, 1);
console.log("formation command authority test passed");
