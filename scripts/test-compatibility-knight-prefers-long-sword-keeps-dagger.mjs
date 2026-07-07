import assert from "node:assert/strict";
import { humanFighters } from "../src/data/humanFighters.js";
import { ensureKnightCloseWeaponLoadout } from "../src/utils/knightLoadout.js";

const knight = ensureKnightCloseWeaponLoadout(humanFighters.find((actor) => actor.id === "knight"));
assert.deepEqual(knight.favorite_weapons, ["Long Sword"]);
assert.ok(knight.inventory.some((item) => item.name === "Dagger"));
assert.equal(knight.inventory.some((item) => item.name === "Short Sword"), false);

console.log("Compatibility Knight primary/backup weapon tests passed");
