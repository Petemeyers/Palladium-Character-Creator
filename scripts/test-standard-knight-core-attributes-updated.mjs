import assert from "node:assert/strict";
import { humanFighters } from "../src/data/humanFighters.js";

const knight = humanFighters.find((actor) => actor.id === "knight");
assert.ok(knight, "standard Knight should remain in the human fighter roster");
assert.deepEqual(knight.attributes, {
  might: 15,
  deftness: 11,
  vigor: 12,
  endurance: 14,
  mobility: 9,
  intellect: 10,
  awareness: 11,
  cunning: 10,
  resolve: 13,
  discipline: 14,
  presence: 12,
  renown: 1,
  favor: 0,
});
assert.equal(knight.HP, 24);
assert.equal(knight.speed, 25);
assert.equal(knight.actionsPerRound, 2);
assert.deepEqual(knight.bonuses, { attack: 3, block: 3, evade: 1, damage: 2 });

console.log("Standard Knight core attribute tests passed");
