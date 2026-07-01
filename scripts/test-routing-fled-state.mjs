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
import {
  buildRoutRecoveryContext,
  findRoutingDestination,
  getThreatPositionsForFighter,
  hasSatisfiedRoutingExit,
  resolveRoutedTurnRecovery,
} from "../src/utils/routingSystem.js";
import { normalizeMoraleState } from "../src/utils/morale/moraleChecks.js";

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
const fixedRoll = (roll) => () => (roll - 1) / 20;
const distanceFeet = (left, right) => Math.hypot(left.x - right.x, left.y - right.y) * 5;

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
assert.equal(fledMinotaur.state.moraleState, "fled");
assert.equal(fledMinotaur.state.hasFledBattle, true);
assert.equal(fledMinotaur.inBattle, false);

assert.equal(isCombatantFled(fledMinotaur), true);
assert.equal(isActiveCombatantForHostility(fledMinotaur), false, "fled actor is skipped by active scheduling/hostility lists");
assert.equal(canTargetForAction(player, fledMinotaur, "attack"), false);
assert.equal(canTargetForAction(fledMinotaur, player, "attack"), false, "fled actor cannot select targets");

const canonicalFledActor = {
  ...minotaur,
  id: "canonical-fled",
  state: { moraleState: "fled", hasFledBattle: true },
  moraleState: { status: "STEADY", hasFled: false },
  statusEffects: [],
};
assert.equal(isCombatantFled(canonicalFledActor), true, "canonical fled state is excluded from selection");
assert.equal(isActiveCombatantForHostility(canonicalFledActor), false, "canonical fled actor cannot receive a turn");
assert.equal(canTargetForAction(player, canonicalFledActor, "attack"), false, "canonical fled actor cannot be targeted");

const outOfBattleActor = {
  ...minotaur,
  id: "out-of-battle",
  inBattle: false,
  moraleState: { status: "STEADY", hasFled: false },
  statusEffects: [],
};
assert.equal(isCombatantFled(outOfBattleActor), true, "explicitly out-of-battle actor is excluded");

const normalizedRouted = normalizeMoraleState(minotaur);
assert.equal(normalizedRouted.state.moraleState, "routed", "legacy routed state bridges to canonical morale state");

const routedSoldier = {
  ...player,
  id: "routed-soldier",
  attributes: { resolve: 14, discipline: 14 },
  moraleState: { status: "ROUTED", hasFled: false },
  statusEffects: ["ROUTED"],
  state: { moraleState: "routed", routTurns: 2, minimumRoutTurns: 2, hasFledBattle: false },
};
const commander = {
  ...player,
  id: "commander",
  aiRole: "commander",
  attributes: { presence: 16 },
};
const recoveryPositions = {
  [routedSoldier.id]: { x: 4, y: 4 },
  [commander.id]: { x: 5, y: 4 },
  [minotaur.id]: { x: 3, y: 4 },
};
const recoveryContext = buildRoutRecoveryContext({
  actor: routedSoldier,
  fighters: [routedSoldier, commander, minotaur],
  positions: recoveryPositions,
  calculateDistance: distanceFeet,
});
assert.equal(recoveryContext.commanderNearby, true);
assert.equal(recoveryContext.commanderPresenceBonus, 3);
assert.equal(recoveryContext.alliesNearby, 1);
assert.equal(recoveryContext.enemyAdjacent, true);

const liveRecovery = resolveRoutedTurnRecovery({
  actor: routedSoldier,
  fighters: [routedSoldier, commander],
  positions: recoveryPositions,
  calculateDistance: distanceFeet,
  turnKey: "turn-1",
  rng: fixedRoll(12),
});
assert.equal(liveRecovery.result, "strong_recovery");
assert.equal(liveRecovery.actor.state.moraleState, "uneasy");
assert.equal(liveRecovery.actor.moraleState.status, "UNEASY");
assert.equal(liveRecovery.actor.inBattle, true);
assert.equal(liveRecovery.actor.remainingActions, 0, "recovery consumes the current routed turn");
assert.equal(liveRecovery.actor.statusEffects.includes("ROUTED"), false);

const partialRecovery = resolveRoutedTurnRecovery({
  actor: routedSoldier,
  fighters: [routedSoldier],
  positions: recoveryPositions,
  calculateDistance: distanceFeet,
  rng: fixedRoll(11),
});
assert.equal(partialRecovery.result, "partial_recovery");
assert.equal(partialRecovery.actor.state.moraleState, "shaken");

const failedRecovery = resolveRoutedTurnRecovery({
  actor: { ...routedSoldier, attributes: { resolve: 6, discipline: 6 } },
  fighters: [routedSoldier, minotaur],
  positions: recoveryPositions,
  calculateDistance: distanceFeet,
  turnKey: "turn-2",
  rng: fixedRoll(1),
});
assert.equal(failedRecovery.result, "still_routed");
assert.equal(failedRecovery.actor.state.moraleState, "routed");
const retreatAfterFailure = findRoutingDestination({
  currentPos: recoveryPositions[routedSoldier.id],
  threatPositions: [recoveryPositions[minotaur.id]],
  maxSteps: 2,
  isHexOccupied: () => false,
  getHexNeighbors: (x, y) => [
    { x: x - 1, y }, { x: x + 1, y }, { x, y: y - 1 }, { x, y: y + 1 },
  ],
  isValidPosition: (x, y) => x >= 0 && y >= 0 && x < 10 && y < 10,
  calculateDistance: distanceFeet,
  gridWidth: 10,
  gridHeight: 10,
});
assert.ok(retreatAfterFailure?.position, "existing routed movement remains available after failed recovery");

const recoveringMinotaur = resolveRoutedTurnRecovery({
  actor: {
    ...minotaur,
    attributes: { might: 18, resolve: 12, discipline: 6, presence: 18 },
    state: { moraleState: "routed", routTurns: 2, minimumRoutTurns: 2 },
  },
  fighters: [minotaur],
  positions: recoveryPositions,
  calculateDistance: distanceFeet,
  rng: fixedRoll(20),
});
assert.equal(recoveringMinotaur.result, "strong_recovery", "routed Minotaur can recover before fleeing");
assert.equal(recoveringMinotaur.actor.state.moraleState, "uneasy");

const recoveryWithRoutingDisabled = resolveRoutedTurnRecovery({
  actor: { ...routedSoldier, routingEnabled: false },
  fighters: [routedSoldier],
  positions: recoveryPositions,
  calculateDistance: distanceFeet,
  rng: fixedRoll(20),
});
assert.equal(
  recoveryWithRoutingDisabled.result,
  "strong_recovery",
  "routing disabled does not freeze recovery for an actor already routed",
);

const fledRecovery = resolveRoutedTurnRecovery({
  actor: fledMinotaur,
  fighters: [fledMinotaur],
  positions: {},
  calculateDistance: distanceFeet,
  rng: fixedRoll(20),
});
assert.equal(fledRecovery.result, "already_fled", "fled actors never recover");

const routingDisabledUpdate = {
  ...fledMinotaur,
  routingEnabled: false,
  inBattle: true,
  status: "active",
  active: true,
  fled: false,
  canAct: true,
  remainingActions: 1,
  moraleState: { status: "STEADY", hasFled: false },
  state: { moraleState: "steady", hasFledBattle: false },
  statusEffects: [],
};
const preservedFled = preserveCombatantFledState(fledMinotaur, routingDisabledUpdate);
assert.equal(preservedFled.status, "fled");
assert.equal(preservedFled.fled, true);
assert.equal(preservedFled.canAct, false);
assert.equal(preservedFled.active, false, "routing setting changes cannot reactivate fled actors");
assert.equal(preservedFled.state.moraleState, "fled");
assert.equal(preservedFled.state.hasFledBattle, true, "routing disabled cannot clear permanent fled state");
assert.equal(preservedFled.inBattle, false);

const positions = removeFledCombatantPositions(
  [player, preservedFled],
  { [player.id]: { x: 2, y: 2 }, [preservedFled.id]: { x: 9, y: 4 } }
);
assert.deepEqual(positions, { [player.id]: { x: 2, y: 2 } });

const enemyFledState = getCombatHostilityState([player, fledMinotaur]);
assert.deepEqual(enemyFledState.activeCombatants.map((actor) => actor.id), [player.id]);
assert.equal(enemyFledState.hasHostileSides, false, "fled enemy no longer blocks player victory");
assert.deepEqual(
  getThreatPositionsForFighter(player, [player, canonicalFledActor], {
    [player.id]: { x: 2, y: 2 },
    [canonicalFledActor.id]: { x: 3, y: 2 },
  }),
  [],
  "fled actors are excluded from routing threat selection",
);

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
