import assert from "node:assert/strict";
import {
  createPersistentWeaponBind,
  getActiveWeaponBinds,
  getWeaponBindAttackModifier,
  reconcilePersistentWeaponBinds,
  upsertPersistentWeaponBind,
} from "../src/utils/combat/weaponBindAuthority.js";

const registry = new Map();
const bind = createPersistentWeaponBind({
  sourceActorId: "a",
  targetActorId: "b",
  sourceWeaponId: "sword-a",
  targetWeaponId: "sword-b",
  currentRound: 3,
  durationRounds: 2,
});
upsertPersistentWeaponBind(registry, bind);
assert.equal(getActiveWeaponBinds(registry, 3).length, 1);
assert.equal(getWeaponBindAttackModifier({ registry, attackerId: "a", targetId: "b", currentRound: 3 }).modifier, 1);
assert.equal(getWeaponBindAttackModifier({ registry, attackerId: "b", targetId: "a", currentRound: 3 }).modifier, -1);
assert.equal(getWeaponBindAttackModifier({ registry, attackerId: "b", targetId: "c", currentRound: 3 }).modifier, -2);

const actors = [
  { id: "a", selectedAttack: { id: "sword-a" } },
  { id: "b", selectedAttack: { id: "sword-b" } },
];
reconcilePersistentWeaponBinds(registry, {
  combatants: actors,
  positions: { a: { x: 0, y: 0 }, b: { x: 2, y: 0 } },
  currentRound: 3,
  getWeapon: (actor) => actor.selectedAttack,
  calculateDistanceFeet: (left, right) => Math.abs(left.x - right.x) * 5,
});
assert.equal(getActiveWeaponBinds(registry, 3).length, 0);
console.log("weapon bind authority test passed");
