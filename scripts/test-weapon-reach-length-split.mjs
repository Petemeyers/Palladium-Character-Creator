import assert from "node:assert/strict";

import SELECTABLE_ACTORS from "../src/data/selectableActors.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";
import { canUseWeapon, getWeaponLength } from "../src/utils/combatEnvironmentLogic.js";

const minotaurSource = SELECTABLE_ACTORS.find((actor) => actor.id === "minotaur");
const championSource = SELECTABLE_ACTORS.find((actor) => actor.id === "arena-champion");
const sourceHeavyAxe = minotaurSource.attacks.find((attack) => attack.name === "Heavy Axe");
const minotaur = adaptSelectableActorToCombatant(minotaurSource).combatant;
const heavyAxe = minotaur.attacks.find((attack) => attack.name === "Heavy Axe");

assert.equal(sourceHeavyAxe.reach, 10, "Heavy Axe attack reach remains 10ft");
assert.equal(sourceHeavyAxe.lengthFt, 6, "Heavy Axe physical length is 6ft");
assert.equal(heavyAxe.reach, 10);
assert.equal(heavyAxe.reachFeet, 10);
assert.equal(heavyAxe.lengthFt, 6, "adapter preserves physical length separately from attack reach");
assert.equal(getWeaponLength(heavyAxe), 6, "cramped-space logic prefers physical length");
assert.deepEqual(
  canUseWeapon(heavyAxe, "OPEN_GROUND", [minotaur]),
  { canUse: true, reason: "Weapon usable in current terrain" },
  "a 6ft Heavy Axe remains usable in 7.7ft of available width",
);

const legacyReachWeapon = { name: "Legacy Reach Weapon", reach: 10 };
assert.equal(getWeaponLength(legacyReachWeapon), 10, "legacy weapons still fall back to reach");
assert.equal(
  canUseWeapon(legacyReachWeapon, "OPEN_GROUND", [minotaur]).canUse,
  false,
  "legacy reach fallback keeps the existing weapon-too-long rule",
);

const longbowman = adaptSelectableActorToCombatant(
  SELECTABLE_ACTORS.find((actor) => actor.id === "longbowman"),
).combatant;
const longbowShot = longbowman.attacks.find((attack) => attack.name === "Longbow Shot");
assert.equal(longbowShot.range, 150);
assert.equal(longbowShot.reach, null);
assert.equal(longbowShot.lengthFt, null, "ranged attacks do not inherit melee length metadata");

assert.equal(minotaur.name, "Minotaur");
assert.equal(minotaur.modelKey, "minotaur");
assert.notEqual(minotaur.selectableActorId, championSource.id);

console.log("weapon reach and physical length split tests passed");
