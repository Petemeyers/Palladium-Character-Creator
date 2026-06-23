import assert from "node:assert/strict";
import { buildPublicPlayerAttackPreviews } from "../src/utils/publicPlayerAttackPreview.js";

const fighter = {
  name: "Alden",
  publicClassName: "Fighter",
  finalAbilityScores: {
    str: 16,
    dex: 12,
  },
  abilityModifiers: {
    str: 3,
    dex: 1,
  },
  publicDerivedStats: {
    proficiencyBonus: 2,
  },
  publicStartingEquipment: {
    classOption: {
      items: ["Longsword", "Shield"],
    },
  },
};

const fighterSnapshot = JSON.stringify(fighter);
const fighterPreviews = buildPublicPlayerAttackPreviews(fighter);
const longsword = fighterPreviews.find((preview) => preview.name === "Longsword");

assert.ok(longsword, "Fighter should get a longsword preview");
assert.equal(longsword.attackType, "melee", "Longsword should preview as melee");
assert.equal(longsword.abilityUsed, "STR", "Longsword should use Strength");
assert.equal(longsword.hitBonus, "+5", "Longsword should include ability plus proficiency to hit");
assert.equal(longsword.damageExpression, "1d8+3", "Longsword should include Strength in damage preview");
assert.equal(longsword.damageType, "slashing", "Longsword damage type should display");
assert.equal(JSON.stringify(fighter), fighterSnapshot, "Preview generation should not mutate fighter source");

const rogue = {
  name: "Mira",
  publicClassName: "Rogue",
  finalAbilityScores: {
    str: 10,
    dex: 16,
  },
  abilityModifiers: {
    str: 0,
    dex: 3,
  },
  publicDerivedStats: {
    proficiencyBonus: 2,
  },
  publicStartingEquipment: {
    classOption: {
      items: ["Shortbow", "Leather Armor"],
    },
  },
};

const roguePreviews = buildPublicPlayerAttackPreviews(rogue);
const shortbow = roguePreviews.find((preview) => preview.name === "Shortbow");

assert.ok(shortbow, "Rogue should get a shortbow preview");
assert.equal(shortbow.attackType, "ranged", "Shortbow should preview as ranged");
assert.equal(shortbow.abilityUsed, "DEX", "Shortbow should use Dexterity");
assert.equal(shortbow.hitBonus, "+5", "Shortbow should include ability plus proficiency to hit");
assert.equal(shortbow.damageExpression, "1d6+3", "Shortbow should include Dexterity in damage preview");
assert.equal(shortbow.damageType, "piercing", "Shortbow damage type should display");

const noWeapon = {
  name: "No Weapon",
  finalAbilityScores: { str: 12 },
  abilityModifiers: { str: 1 },
  publicDerivedStats: { proficiencyBonus: 2 },
};
const noWeaponPreviews = buildPublicPlayerAttackPreviews(noWeapon);
assert.equal(noWeaponPreviews.length, 1, "Character with no weapon metadata should get one safe fallback preview");
assert.equal(noWeaponPreviews[0].name, "Unarmed Strike", "Missing weapon metadata should fall back to unarmed strike");
assert.equal(
  noWeaponPreviews[0].notes,
  "Attack preview pending: no public weapon metadata found.",
  "Missing weapon metadata should explain the pending preview"
);

assert.doesNotThrow(() => buildPublicPlayerAttackPreviews(null), "Null input should not throw");
assert.doesNotThrow(() => buildPublicPlayerAttackPreviews({ publicStartingEquipment: { classOption: { items: [{ nested: true }] } } }), "Malformed equipment should not throw");

console.log("Public player attack preview tests passed.");
