import assert from "node:assert/strict";
import {
  advancePublicTurnOrder,
  buildPublicTurnOrderRows,
  canStartPublicTurnOrder,
} from "../src/utils/publicTurnOrder.js";

const player = {
  id: "player-1",
  name: "Alden",
  side: "player",
  HP: 12,
  finalAbilityScores: { dex: 14 },
};
const enemy = {
  id: "enemy-1",
  name: "Goblin Warrior",
  side: "enemy",
  HP: 7,
  abilityScores: { dex: 12 },
  source: "public-enemy",
};
const playerSnapshot = JSON.stringify(player);
const enemySnapshot = JSON.stringify(enemy);

const ordered = buildPublicTurnOrderRows([player, enemy], {
  rollD20: (combatant) => (combatant.id === "player-1" ? 8 : 15),
});

assert.equal(ordered.length, 2, "Two combatants should produce two turn rows");
assert.equal(ordered[0].id, "enemy-1", "Enemy should sort first with higher total");
assert.equal(ordered[0].initiativeRoll, 15, "Injected enemy roll should be used");
assert.equal(ordered[0].initiativeBonus, 1, "Enemy Dexterity 12 should give +1");
assert.equal(ordered[0].totalInitiative, 16, "Enemy total should include roll and bonus");
assert.equal(ordered[0].maxActions, 1, "Turn rows should default to 1 max action");
assert.equal(ordered[0].remainingActions, 1, "Turn rows should start with 1 remaining action");
assert.equal(ordered[0].maxStamina, 10, "Turn rows should initialize combat stamina");
assert.equal(ordered[0].currentStamina, 10, "Turn rows should start with full stamina");
assert.equal(ordered[0].fatigueLabel, "Fresh", "Turn rows should start Fresh");
assert.equal(ordered[1].id, "player-1", "Player should sort second");
assert.equal(ordered[1].initiativeBonus, 2, "Player Dexterity 14 should give +2");
assert.equal(ordered[1].totalInitiative, 10, "Player total should include roll and bonus");

const tied = buildPublicTurnOrderRows([player, enemy], {
  rollD20: (combatant) => (combatant.id === "player-1" ? 10 : 11),
});
assert.equal(tied[0].id, "player-1", "Tie should preserve original order");
assert.equal(tied[1].id, "enemy-1", "Tie should preserve original order for later rows");

const advanced = advancePublicTurnOrder({
  turnOrder: ordered,
  currentIndex: 0,
  round: 1,
  combatants: [player, enemy],
});
assert.equal(advanced.currentIndex, 1, "End turn should advance to the next combatant");
assert.equal(advanced.round, 1, "Round should not increment before wrapping");

const wrapped = advancePublicTurnOrder({
  turnOrder: ordered.map((row, index) => index === 0 ? { ...row, remainingActions: 0 } : row),
  currentIndex: 1,
  round: 1,
  combatants: [player, enemy],
});
assert.equal(wrapped.currentIndex, 0, "End turn from final row should wrap to the first row");
assert.equal(wrapped.round, 2, "Wrapping should increment the round");
assert.equal(wrapped.wrapped, true, "Wrap should be reported");
assert.equal(wrapped.current.remainingActions, 1, "Next current combatant should reset to max actions");
assert.equal(wrapped.turnOrder[0].remainingActions, 1, "Turn order should store the reset action budget");

const skipped = advancePublicTurnOrder({
  turnOrder: ordered,
  currentIndex: 0,
  round: 1,
  combatants: [{ ...player, HP: 0 }, enemy],
});
assert.equal(skipped.current.id, "enemy-1", "0 HP combatants should be skipped when advancing");

const missingInitiative = buildPublicTurnOrderRows([{ id: "no-dex", name: "No Dexterity", side: "player" }], {
  rollD20: () => 20,
});
assert.equal(missingInitiative[0].ready, false, "Missing initiative data should not be ready");
assert.ok(missingInitiative[0].missingFields.includes("dexterity"), "Missing Dexterity should be reported");
assert.equal(missingInitiative[0].initiativeRoll, null, "Missing initiative data should not roll");

assert.equal(canStartPublicTurnOrder([player, enemy]), true, "Ready opposing sides should allow manual order start");
assert.equal(canStartPublicTurnOrder([player]), false, "One side alone should not allow manual order start");
assert.equal(JSON.stringify(player), playerSnapshot, "Turn utility should not mutate player");
assert.equal(JSON.stringify(enemy), enemySnapshot, "Turn utility should not mutate enemy");

console.log("Public turn order tests passed.");
