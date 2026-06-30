import assert from "node:assert/strict";

import {
  decideEnemyTacticalIntent,
  decideEnemyTacticalIntentSafely,
} from "../src/utils/enemyAttributeTacticalIntent.js";

const actor = (name, attributes, extra = {}) => ({
  id: name.toLowerCase().replaceAll(" ", "-"),
  name,
  originalActorMetadata: { attributes },
  currentHP: 20,
  maxHP: 20,
  ...extra,
});

const knight = actor("Knight", {
  resolve: 16,
  discipline: 16,
  mobility: 12,
  awareness: 12,
  cunning: 10,
  presence: 12,
  vigor: 14,
  endurance: 14,
  might: 14,
});
let decision = decideEnemyTacticalIntent({ actor: knight, distanceFt: 60, enemies: [{ id: "foe" }] });
assert.ok(["advance", "cautious_advance"].includes(decision.intent));

const goblin = actor("Goblin Warrior", {
  resolve: 9,
  discipline: 8,
  mobility: 16,
  awareness: 12,
  cunning: 16,
  presence: 8,
  vigor: 10,
  endurance: 12,
  might: 9,
});
decision = decideEnemyTacticalIntent({ actor: goblin, distanceFt: 60, enemies: [{ id: "foe" }] });
assert.ok(["flank", "cautious_advance"].includes(decision.intent));

const minotaur = actor("Minotaur", {
  resolve: 16,
  discipline: 10,
  mobility: 12,
  awareness: 10,
  cunning: 9,
  presence: 16,
  vigor: 16,
  endurance: 16,
  might: 18,
}, { aiRole: "brute", tags: ["mythic", "brute"] });
decision = decideEnemyTacticalIntent({ actor: minotaur, distanceFt: 80, enemies: [{ id: "foe" }] });
assert.equal(decision.intent, "advance");

const shaken = actor("Shaken Raider", {
  resolve: 6,
  discipline: 9,
  mobility: 10,
  awareness: 12,
  cunning: 10,
  presence: 8,
  vigor: 8,
  endurance: 8,
  might: 10,
}, { currentHP: 4, maxHP: 20 });
decision = decideEnemyTacticalIntent({
  actor: shaken,
  distanceFt: 40,
  allies: [],
  enemies: [{ id: "a" }, { id: "b" }, { id: "c" }],
});
assert.ok(["hold", "hesitate"].includes(decision.intent));

const defender = actor("Disciplined Guard", {
  resolve: 12,
  discipline: 18,
  mobility: 10,
  awareness: 14,
  cunning: 10,
  presence: 10,
  vigor: 10,
  endurance: 12,
  might: 12,
}, { aiRole: "defensive" });
decision = decideEnemyTacticalIntent({
  actor: defender,
  distanceFt: 35,
  enemies: [{ id: "a" }, { id: "b" }, { id: "c" }],
});
assert.equal(decision.intent, "hold");

decision = decideEnemyTacticalIntent({
  actor: knight,
  target: { name: "Longbowman" },
  distanceFt: 5,
  meleeRangeFt: 5,
  movementContext: { hasAttackOption: true },
});
assert.equal(decision.intent, "attack");

decision = decideEnemyTacticalIntent({ actor: { id: "legacy", name: "Legacy Enemy" }, distanceFt: 30 });
assert.equal(decision.intent, "cautious_advance");
assert.ok(Number.isFinite(decision.confidence));

const pureActor = structuredClone(goblin);
const pureTarget = { id: "target", name: "Target" };
const actorBefore = structuredClone(pureActor);
const targetBefore = structuredClone(pureTarget);
decideEnemyTacticalIntent({ actor: pureActor, target: pureTarget, distanceFt: 50 });
assert.deepEqual(pureActor, actorBefore, "intent scoring does not mutate actor");
assert.deepEqual(pureTarget, targetBefore, "intent scoring does not mutate target");

let capturedError = null;
const brokenActor = new Proxy({}, { get: () => { throw new Error("broken metadata"); } });
decision = decideEnemyTacticalIntentSafely(
  { actor: brokenActor, distanceFt: 50 },
  (error) => { capturedError = error; },
);
assert.equal(decision.intent, "advance");
assert.deepEqual(decision.reasons, ["intent fallback"]);
assert.match(capturedError.message, /broken metadata/);

console.log("enemy attribute tactical intent tests passed");
