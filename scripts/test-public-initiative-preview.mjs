import assert from "node:assert/strict";
import {
  buildPublicInitiativePreviewRow,
  buildPublicInitiativePreviewRows,
} from "../src/utils/publicInitiativePreview.js";

const publicPlayer = {
  id: "player-1",
  name: "Mira",
  side: "player",
  source: "saved-character",
  finalAbilityScores: {
    dex: 15,
  },
};
const playerSnapshot = JSON.stringify(publicPlayer);
const playerPreview = buildPublicInitiativePreviewRow(publicPlayer);

assert.equal(playerPreview.name, "Mira", "Public player name should display");
assert.equal(playerPreview.side, "player", "Public player side should display");
assert.equal(playerPreview.dexterityModifier, 2, "Dexterity 15 should produce +2 modifier");
assert.equal(playerPreview.initiativeBonus, 2, "Public player initiative bonus should use Dexterity modifier");
assert.equal(playerPreview.initiativeBonusLabel, "+2", "Public player initiative bonus should be formatted");
assert.equal(playerPreview.status, "ready", "Public player should be initiative-preview ready");
assert.equal(JSON.stringify(publicPlayer), playerSnapshot, "Initiative preview should not mutate public player");

const publicEnemy = {
  id: "enemy-1",
  name: "Goblin Warrior",
  side: "enemy",
  source: "public-enemy",
  abilityScores: {
    dex: 14,
  },
};
const enemyPreview = buildPublicInitiativePreviewRow(publicEnemy);

assert.equal(enemyPreview.side, "enemy", "Enemy side should display");
assert.equal(enemyPreview.dexterityModifier, 2, "Enemy Dexterity 14 should produce +2 modifier");
assert.equal(enemyPreview.initiativeBonus, 2, "Enemy initiative bonus should use Dexterity modifier");
assert.equal(enemyPreview.initiativeBonusLabel, "+2", "Enemy initiative bonus should be formatted");

const missingDexterity = {
  id: "missing-dex",
  name: "No Dexterity",
  side: "enemy",
};
const missingPreview = buildPublicInitiativePreviewRow(missingDexterity);

assert.equal(missingPreview.status, "missing fields", "Missing Dexterity should not be ready");
assert.ok(missingPreview.missingFields.includes("dexterity"), "Missing Dexterity should be reported");
assert.equal(missingPreview.initiativeBonusLabel, "Missing", "Missing bonus should display clearly");

const deterministicPreview = buildPublicInitiativePreviewRow(publicPlayer, {
  rollPreview: () => 10,
});
assert.equal(deterministicPreview.rollPreview, 10, "Deterministic roll preview should be stored");
assert.equal(deterministicPreview.rollPreviewLabel, "12", "Deterministic roll preview should add initiative bonus");

assert.doesNotThrow(() => buildPublicInitiativePreviewRow(null), "Null input should not throw");
assert.doesNotThrow(() => buildPublicInitiativePreviewRows(null), "Null list should not throw");
assert.deepEqual(buildPublicInitiativePreviewRows(null), [], "Null list should produce no rows");

console.log("Public initiative preview tests passed.");
