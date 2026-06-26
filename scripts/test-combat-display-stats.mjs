import assert from "node:assert/strict";

import { buildCombatDisplayStats } from "../src/utils/combatDisplayStats.js";

const clone = (value) => JSON.parse(JSON.stringify(value));

const hasFunction = (value) => {
  if (typeof value === "function") return true;
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(hasFunction);
};

const hasOnlyPlainContainers = (value) => {
  if (!value || typeof value !== "object") return true;
  if (Array.isArray(value)) return value.every(hasOnlyPlainContainers);
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.values(value).every(hasOnlyPlainContainers);
};

const savedWithFinalScores = {
  id: "saved-final",
  name: "Kina",
  type: "player",
  source: "saved-character",
  generated: false,
  hp: -1,
  maxHP: 13,
  guardRating: 13,
  speed: 30,
  stamina: 0,
  fatigueState: {
    currentStamina: 24,
    maxStamina: 24,
  },
  finalAbilityScores: {
    str: 16,
    dex: 15,
    con: 12,
    int: 13,
    wis: 8,
    cha: 10,
  },
  attributes: {
    IQ: 13,
    ME: 8,
    MA: 10,
    PS: 16,
    PP: 15,
    PE: 12,
    PB: 10,
    Spd: 16,
  },
};
const savedFinalSnapshot = clone(savedWithFinalScores);
const savedFinalDisplay = buildCombatDisplayStats(savedWithFinalScores);

assert.equal(savedFinalDisplay.sourceLabel, "Saved Character");
assert.equal(savedFinalDisplay.abilityScores.strength, 16, "finalAbilityScores should drive Strength display");
assert.equal(savedFinalDisplay.abilityScores.dexterity, 15, "finalAbilityScores should drive Dexterity display");
assert.equal(savedFinalDisplay.abilityScores.intelligence, 13, "finalAbilityScores should drive Intelligence display");
assert.equal(savedFinalDisplay.movementSpeed, 30, "movement speed should come from movement speed fields");
assert.equal(savedFinalDisplay.legacySpdAttribute, 16, "compatibility Spd should remain separate");
assert.equal(savedFinalDisplay.staminaCurrent, 24, "fatigue stamina should beat stale raw stamina");
assert.equal(savedFinalDisplay.staminaMax, 24, "fatigue max stamina should be used with fatigue current stamina");
assert.deepEqual(savedWithFinalScores, savedFinalSnapshot, "display helper should not mutate saved character input");

const savedWithPublicScores = {
  name: "Public Scores",
  source: "saved-character",
  publicAbilityScores: {
    str: 14,
    dex: 12,
    con: 11,
    int: 10,
    wis: 9,
    cha: 8,
  },
  publicDerivedStats: {
    speed: 25,
  },
};
const savedPublicDisplay = buildCombatDisplayStats(savedWithPublicScores);

assert.equal(savedPublicDisplay.abilityScores.strength, 14, "publicAbilityScores should drive display when final scores are absent");
assert.equal(savedPublicDisplay.movementSpeed, 25, "publicDerivedStats.speed should be preferred for movement");

const compatibilityOnly = {
  name: "Compatibility",
  attributes: {
    IQ: 9,
    ME: 10,
    MA: 11,
    PS: 12,
    PP: 13,
    PE: 14,
    PB: 15,
    Spd: 16,
  },
};
const compatibilityDisplay = buildCombatDisplayStats(compatibilityOnly);

assert.equal(compatibilityDisplay.sourceLabel, "Compatibility");
assert.deepEqual(compatibilityDisplay.compatibilityAttributes, {
  IQ: 9,
  ME: 10,
  MA: 11,
  PS: 12,
  PP: 13,
  PE: 14,
  PB: 15,
  Spd: 16,
});
assert.equal(compatibilityDisplay.abilityScores.strength, 12, "compatibility PS should remain a fallback for Strength display");
assert.equal(compatibilityDisplay.movementSpeed, 30, "movement speed should not be confused with compatibility Spd");

assert.equal(buildCombatDisplayStats({ generated: true }).sourceLabel, "Generated");
assert.equal(buildCombatDisplayStats({ type: "enemy" }).sourceLabel, "Enemy");

assert.doesNotThrow(() => buildCombatDisplayStats(null), "malformed combatant should not throw");
const malformedDisplay = buildCombatDisplayStats({ name: "Broken", attributes: "bad", stamina: 0 });
assert.equal(typeof malformedDisplay, "object", "malformed combatant should still return display stats");

assert.equal(hasFunction(savedFinalDisplay), false, "display helper output should contain no functions");
assert.equal(hasOnlyPlainContainers(savedFinalDisplay), true, "display helper output should contain only plain display containers");

console.log("Combat display stats tests passed.");
