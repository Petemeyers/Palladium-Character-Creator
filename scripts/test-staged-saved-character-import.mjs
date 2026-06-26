import assert from "node:assert/strict";

import {
  adaptPublicCharacterToRosterEntry,
  resolveStagedSavedCharacterForImport,
} from "../src/utils/publicRosterAdapter.js";
import {
  getPlayableCharacterImportLogLines,
  isSavedCharacterCombatData,
} from "../src/utils/publicCharacterCombatAdapter.js";
import { adaptPublicEnemyToCombatant } from "../src/utils/publicEnemyCombatAdapter.js";
import { PUBLIC_ENEMIES } from "../src/data/publicEnemies.js";

const hasFunction = (value) => {
  if (typeof value === "function") return true;
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(hasFunction);
};
const hasRawObjectString = (value) => JSON.stringify(value).includes("[object Object]");

const savedCharacter = {
  _id: "saved-kara",
  name: "Kara",
  publicClassName: "Fighter",
  publicSpeciesName: "Human",
  publicBackgroundName: "Soldier",
  finalAbilityScores: {
    str: 16,
    dex: 15,
    con: 14,
    int: 11,
    wis: 10,
    cha: 9,
  },
  abilityModifiers: {
    str: 3,
    dex: 2,
    con: 2,
    int: 0,
    wis: 0,
    cha: -1,
  },
  publicDerivedStats: {
    hitPoints: 12,
    baseArmorClass: 12,
    initiative: 2,
    proficiencyBonus: 2,
  },
  speed: 30,
};
const savedSnapshot = JSON.stringify(savedCharacter);

const staleStagedSavedCharacter = {
  id: "saved-kara",
  name: "Old Kara",
  side: "player",
  source: "saved-character",
  generated: true,
  publicAbilityScores: {
    str: 8,
    dex: 8,
    con: 8,
    int: 8,
    wis: 8,
    cha: 8,
  },
  autoRollCharacter: {
    name: "Old Kara",
    playable: true,
    source: "autoroll",
    generated: true,
    attributes: {
      PS: 8,
      PP: 8,
      PE: 8,
      IQ: 8,
      ME: 8,
      MA: 8,
      PB: 8,
      Spd: 8,
    },
  },
};
const stagedSnapshot = JSON.stringify(staleStagedSavedCharacter);

const resolved = resolveStagedSavedCharacterForImport(staleStagedSavedCharacter, [savedCharacter]);
assert.equal(resolved.ok, true, "staged saved character resolves from saved Character List data");
assert.equal(resolved.entry.name, "Kara", "resolved import uses saved character name");
assert.equal(resolved.entry.source, "saved-character");
assert.equal(resolved.entry.sourceCharacterId, "saved-kara");
assert.equal(resolved.entry.generated, false);
assert.deepEqual(resolved.entry.publicAbilityScores, savedCharacter.finalAbilityScores, "saved finalAbilityScores win over stale staged scores");
assert.equal(resolved.entry.autoRollCharacter.attributes.PS, 16, "saved Strength maps to PS");
assert.equal(resolved.entry.autoRollCharacter.attributes.PP, 15, "saved Dexterity maps to PP");
assert.equal(resolved.entry.autoRollCharacter.HP, 12, "saved HP is preserved");
assert.equal(resolved.entry.autoRollCharacter.guardRating, 12, "saved AC is preserved");
assert.equal(isSavedCharacterCombatData(resolved.entry.autoRollCharacter), true, "resolved combat data is marked as saved");
assert.deepEqual(
  getPlayableCharacterImportLogLines(resolved.entry.autoRollCharacter, resolved.entry.name),
  ["Loaded saved character Kara.", "Loaded saved character attributes from Character List."],
  "saved character import logs use loaded wording"
);
assert.equal(
  getPlayableCharacterImportLogLines({ source: "autoroll", generated: true }, "Rolled Fighter")[0],
  "Auto-rolled Rolled Fighter:",
  "true generated characters keep AutoRoll wording"
);

const missing = resolveStagedSavedCharacterForImport(staleStagedSavedCharacter, []);
assert.equal(missing.ok, false, "missing saved character id is skipped safely");
assert.equal(missing.reason, "saved character no longer exists");

const goblin = PUBLIC_ENEMIES.find((enemy) => enemy.id === "goblin-warrior");
const enemyConversion = adaptPublicEnemyToCombatant(goblin);
assert.equal(enemyConversion.ok, true, "public enemy import still works");
assert.equal(enemyConversion.combatant.source, "public-enemy");

const rosterEntry = adaptPublicCharacterToRosterEntry(savedCharacter);
assert.equal(hasFunction(rosterEntry), false, "roster entry contains no functions");
assert.equal(hasRawObjectString(rosterEntry), false, "roster entry contains no raw object strings");
assert.equal(JSON.stringify(savedCharacter), savedSnapshot, "saved character source is not mutated");
assert.equal(JSON.stringify(staleStagedSavedCharacter), stagedSnapshot, "staged entry source is not mutated");

console.log("staged saved character import tests passed");
