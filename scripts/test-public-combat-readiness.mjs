import assert from "node:assert/strict";
import { adaptPublicCharacterToRosterEntry } from "../src/utils/publicRosterAdapter.js";
import { adaptPublicEnemyToRosterEntry } from "../src/utils/publicEnemyRosterAdapter.js";
import PUBLIC_ENEMIES from "../src/data/publicEnemies.js";
import {
  checkPublicEnemyCombatReadiness,
  checkPublicPlayerCombatReadiness,
} from "../src/utils/publicCombatReadiness.js";

const publicCharacter = {
  _id: "public-player-1",
  name: "Mira",
  publicClassName: "Fighter",
  publicSpeciesName: "Human",
  publicBackgroundName: "Guard",
  finalAbilityScores: {
    str: 16,
    dex: 14,
    con: 14,
    int: 10,
    wis: 12,
    cha: 8,
  },
  abilityModifiers: {
    str: 3,
    dex: 2,
    con: 2,
    int: 0,
    wis: 1,
    cha: -1,
  },
  publicDerivedStats: {
    hitPoints: 12,
    baseArmorClass: 12,
    proficiencyBonus: 2,
  },
  speed: 30,
};

const playerEntry = adaptPublicCharacterToRosterEntry(publicCharacter);
const playerSnapshot = JSON.parse(JSON.stringify(playerEntry));
const playerReadiness = checkPublicPlayerCombatReadiness(playerEntry);

assert.equal(playerReadiness.ready, true, "Complete staged public player should be ready for a future playable handoff");
assert.deepEqual(playerReadiness.missing, [], "Complete staged public player should not report missing fields");
assert.deepEqual(playerEntry, playerSnapshot, "Player readiness check should not mutate the entry");

const incompletePlayerReadiness = checkPublicPlayerCombatReadiness({ side: "player", name: "Incomplete" });
assert.equal(incompletePlayerReadiness.ready, false, "Incomplete staged public player should not be ready");
assert.ok(incompletePlayerReadiness.missing.includes("publicClassName"), "Missing public class should be reported");
assert.ok(
  incompletePlayerReadiness.missing.some((field) => field.startsWith("attribute_dice.")),
  "Missing compatibility roll input should be reported"
);

const wolf = PUBLIC_ENEMIES.find((enemy) => enemy.id === "wolf");
const enemyEntry = adaptPublicEnemyToRosterEntry(wolf);
const enemySnapshot = JSON.stringify(enemyEntry);
const enemyReadiness = checkPublicEnemyCombatReadiness(enemyEntry);

assert.equal(enemyReadiness.metadataReady, true, "Public enemy metadata should be complete");
assert.equal(enemyReadiness.ready, true, "Public enemy should be ready after arena-shape mapping");
assert.deepEqual(enemyReadiness.missing, [], "Public enemy metadata should not be missing required public fields");
assert.deepEqual(enemyReadiness.missingArenaShape, [], "Public enemy arena-shape mapping should be complete");
assert.equal(JSON.stringify(enemyEntry), enemySnapshot, "Enemy readiness check should not mutate the entry");

console.log("Public combat readiness tests passed.");
