import assert from "node:assert/strict";

import {
  isCombatantFled,
  markCombatantFled,
  preserveCombatantFledState,
  removeFledCombatantPositions,
} from "../src/utils/combatFledState.js";
import {
  getCombatHostilityState,
  isActiveCombatantForHostility,
} from "../src/utils/combatHostilityState.js";
import { canTargetForAction } from "../src/utils/factionDisposition.js";
import { hasSatisfiedRoutingExit } from "../src/utils/routingSystem.js";

const minotaur = {
  id: "minotaur-1",
  name: "Minotaur",
  type: "enemy",
  team: "enemy",
  status: "active",
  active: true,
  currentHP: 42,
  remainingActions: 2,
  moraleState: { status: "ROUTED", hasFled: false },
  statusEffects: ["ROUTED"],
};
const player = {
  id: "player-1",
  name: "Bato",
  type: "player",
  team: "party",
  status: "active",
  currentHP: 15,
  canAct: true,
};

assert.equal(hasSatisfiedRoutingExit({
  position: { x: 9, y: 4 },
  threatPositions: [{ x: 2, y: 4 }],
  calculateDistance: (left, right) => Math.hypot(left.x - right.x, left.y - right.y) * 5,
  gridWidth: 10,
  gridHeight: 8,
  routingProfile: { exitMode: "map_edge" },
}), true, "routed actor at the escape edge satisfies exit detection");

const fledMinotaur = markCombatantFled(minotaur);
assert.equal(fledMinotaur.status, "fled");
assert.equal(fledMinotaur.moraleState.status, "FLED");
assert.equal(fledMinotaur.moraleState.hasFled, true);
assert.equal(fledMinotaur.fled, true);
assert.equal(fledMinotaur.active, false);
assert.equal(fledMinotaur.canAct, false);
assert.equal(fledMinotaur.remainingActions, 0);
assert.equal(fledMinotaur.statusEffects.includes("FLED"), true);
assert.equal(fledMinotaur.statusEffects.includes("ROUTED"), false);

assert.equal(isCombatantFled(fledMinotaur), true);
assert.equal(isActiveCombatantForHostility(fledMinotaur), false, "fled actor is skipped by active scheduling/hostility lists");
assert.equal(canTargetForAction(player, fledMinotaur, "attack"), false);
assert.equal(canTargetForAction(fledMinotaur, player, "attack"), false, "fled actor cannot select targets");

const routingDisabledUpdate = {
  ...fledMinotaur,
  status: "active",
  active: true,
  fled: false,
  canAct: true,
  remainingActions: 1,
  moraleState: { status: "STEADY", hasFled: false },
  statusEffects: [],
};
const preservedFled = preserveCombatantFledState(fledMinotaur, routingDisabledUpdate);
assert.equal(preservedFled.status, "fled");
assert.equal(preservedFled.fled, true);
assert.equal(preservedFled.canAct, false);
assert.equal(preservedFled.active, false, "routing setting changes cannot reactivate fled actors");

const positions = removeFledCombatantPositions(
  [player, preservedFled],
  { [player.id]: { x: 2, y: 2 }, [preservedFled.id]: { x: 9, y: 4 } }
);
assert.deepEqual(positions, { [player.id]: { x: 2, y: 2 } });

const enemyFledState = getCombatHostilityState([player, fledMinotaur]);
assert.deepEqual(enemyFledState.activeCombatants.map((actor) => actor.id), [player.id]);
assert.equal(enemyFledState.hasHostileSides, false, "fled enemy no longer blocks player victory");

const fledPlayer = markCombatantFled(player);
const activeEnemy = { ...minotaur, moraleState: { status: "STEADY", hasFled: false }, statusEffects: [] };
const playerFledState = getCombatHostilityState([fledPlayer, activeEnemy]);
assert.deepEqual(playerFledState.activeCombatants.map((actor) => actor.id), [activeEnemy.id]);
assert.equal(playerFledState.hasHostileSides, false, "fled player counts as removed for defeat");

assert.equal(fledMinotaur.currentHP, minotaur.currentHP, "fleeing does not change HP");
assert.equal(fledMinotaur.isDead, undefined, "fleeing does not mark a living actor dead");
assert.notEqual(String(fledMinotaur.condition || "").toLowerCase(), "dead");
assert.equal(minotaur.status, "active", "fled transition does not mutate its source actor");

console.log("routing fled-state tests passed");
