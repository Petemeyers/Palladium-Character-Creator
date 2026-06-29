import assert from "node:assert/strict";

import SELECTABLE_ACTORS from "../src/data/selectableActors.js";

const requiredIds = [
  "training-dummy",
  "goblin-warrior",
  "bandit",
  "guard",
  "spearman",
  "archer",
  "longbowman",
  "arena-champion",
  "minotaur",
  "hawk",
  "wolf",
  "boar",
];

assert.deepEqual(
  requiredIds.filter((id) => !SELECTABLE_ACTORS.some((actor) => actor.id === id)),
  [],
  "starter actor catalog should include every required actor"
);
assert.equal(new Set(SELECTABLE_ACTORS.map((actor) => actor.id)).size, SELECTABLE_ACTORS.length);

SELECTABLE_ACTORS.forEach((actor) => {
  ["id", "name", "category", "source", "sourceLabel", "teamDefault", "defaultControlMode", "modelKey"].forEach((field) => {
    assert.ok(actor[field] !== undefined && actor[field] !== null && actor[field] !== "", `${actor.id} should include ${field}`);
  });
  assert.equal(typeof actor.playable, "boolean", `${actor.id} should declare playable`);
  assert.ok(actor.movement && typeof actor.movement === "object", `${actor.id} should include movement`);
  assert.ok(Array.isArray(actor.movementModes) && actor.movementModes.length > 0, `${actor.id} should include movement modes`);
  assert.ok(actor.derivedStats && typeof actor.derivedStats === "object", `${actor.id} should include derived stats`);
  assert.ok(Array.isArray(actor.attacks), `${actor.id} should include an attack list`);
  assert.ok(!("attribute_dice" in actor), `${actor.id} should not expose a raw compatibility roster shape`);
});

const longbowman = SELECTABLE_ACTORS.find((actor) => actor.id === "longbowman");
const archer = SELECTABLE_ACTORS.find((actor) => actor.id === "archer");
const champion = SELECTABLE_ACTORS.find((actor) => actor.id === "arena-champion");
const minotaur = SELECTABLE_ACTORS.find((actor) => actor.id === "minotaur");
const hawk = SELECTABLE_ACTORS.find((actor) => actor.id === "hawk");

assert.notEqual(longbowman.id, archer.id);
assert.notEqual(longbowman.id, champion.id);
assert.notEqual(minotaur.id, champion.id);
assert.equal(minotaur.category, "mythic");
assert.equal(minotaur.modelKey, "minotaur");
const heavyAxe = minotaur.attacks.find((attack) => attack.name === "Heavy Axe");
assert.equal(heavyAxe.reach, 10);
assert.equal(heavyAxe.lengthFt, 6);
assert.ok(longbowman.attacks.some((attack) => attack.kind === "ranged" && attack.rangeProfile.normal > 80));
assert.ok(longbowman.attacks.some((attack) => attack.kind === "melee"));
assert.ok(longbowman.equipment.some((item) => item.name === "Arrows" && item.quantity > 0));
assert.ok(hawk.movementModes.includes("flying"));
assert.ok(hawk.movement.flying > hawk.movement.ground);

console.log("selectable actor catalog tests passed");
