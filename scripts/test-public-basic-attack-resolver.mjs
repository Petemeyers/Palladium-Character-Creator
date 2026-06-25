import assert from "node:assert/strict";
import PUBLIC_ENEMIES from "../src/data/publicEnemies.js";
import { createCombatPosture } from "../src/utils/combatPosture.js";
import { adaptPublicEnemyToCombatant } from "../src/utils/publicEnemyCombatAdapter.js";
import { buildPublicPlayerAttackPreviews } from "../src/utils/publicPlayerAttackPreview.js";
import {
  parsePublicDamageExpression,
  resolvePublicBasicAttack,
} from "../src/utils/publicBasicAttackResolver.js";

const fighter = {
  id: "fighter-1",
  name: "Alden",
  side: "player",
  finalAbilityScores: { str: 16 },
  abilityModifiers: { str: 3 },
  publicDerivedStats: { proficiencyBonus: 2 },
  publicStartingEquipment: {
    classOption: {
      items: ["Longsword"],
    },
  },
};
const target = {
  id: "target-1",
  name: "Training Guard",
  side: "enemy",
  armorClass: 15,
};
const fighterSnapshot = JSON.stringify(fighter);
const targetSnapshot = JSON.stringify(target);
const longsword = buildPublicPlayerAttackPreviews(fighter)[0];

const hit = resolvePublicBasicAttack({
  attacker: fighter,
  target,
  attack: longsword,
  rollD20: () => 10,
  rollDamage: () => 5,
});

assert.equal(hit.ok, true, "Longsword attack should resolve");
assert.equal(hit.hit, true, "d20 10 plus +5 should hit AC 15");
assert.equal(hit.totalToHit, 15, "Hit total should be 15");
assert.equal(hit.damageRoll, 5, "Injected damage roll should be used");
assert.equal(hit.damageTotal, 8, "Damage total should add Strength modifier");
assert.equal(hit.damageType, "slashing", "Damage type should carry through");

const miss = resolvePublicBasicAttack({
  attacker: fighter,
  target,
  attack: longsword,
  rollD20: () => 9,
  rollDamage: () => 5,
});

assert.equal(miss.ok, true, "Miss should still resolve");
assert.equal(miss.hit, false, "d20 9 plus +5 should miss AC 15");
assert.equal(miss.totalToHit, 14, "Miss total should be 14");
assert.equal(miss.damageTotal, null, "Miss should not roll damage");

const defendedMiss = resolvePublicBasicAttack({
  attacker: fighter,
  target: {
    ...target,
    combatPosture: createCombatPosture({ type: "defending", round: 1, turnIndex: 0 }),
  },
  attack: longsword,
  rollD20: () => 10,
  rollDamage: () => {
    throw new Error("Damage should not roll when posture turns a hit into a miss");
  },
});

assert.equal(defendedMiss.ok, true, "Defended target attack should resolve");
assert.equal(defendedMiss.hit, false, "Defending should turn total 15 against base AC 15 into a miss against 17");
assert.equal(defendedMiss.baseTargetArmor, 15, "Base target number should be preserved");
assert.equal(defendedMiss.targetArmor, 17, "Defending should raise target number by 2");
assert.equal(defendedMiss.postureEffect.message, "Target is Defending: +2 defense.");

const goblin = PUBLIC_ENEMIES.find((enemy) => enemy.id === "goblin-warrior");
const goblinCombatant = adaptPublicEnemyToCombatant(goblin).combatant;
const goblinAttack = goblinCombatant.publicEnemyMetadata.actions[0];
const playerTarget = {
  id: "player-target",
  name: "Mira",
  side: "player",
  guardRating: 13,
};

const goblinHit = resolvePublicBasicAttack({
  attacker: goblinCombatant,
  target: playerTarget,
  attack: goblinAttack,
  rollD20: () => 9,
  rollDamage: () => 4,
});

assert.equal(goblinHit.ok, true, "Goblin attack should resolve");
assert.equal(goblinHit.hit, true, "Goblin attack should hit with total 13 vs guard 13");
assert.equal(goblinHit.damageTotal, 6, "Goblin damage should add expression modifier");

const invalidDamage = resolvePublicBasicAttack({
  attacker: fighter,
  target,
  attack: { ...longsword, damageExpression: "not damage" },
  rollD20: () => 20,
});

assert.equal(invalidDamage.ok, false, "Invalid damage expression should fail safely");
assert.ok(invalidDamage.missingFields.includes("damageExpression"), "Invalid damage should report missing damageExpression");

const missingArmor = resolvePublicBasicAttack({
  attacker: fighter,
  target: { name: "No Armor", side: "enemy" },
  attack: longsword,
  rollD20: () => 20,
});

assert.equal(missingArmor.ok, false, "Missing target armor should fail safely");
assert.ok(missingArmor.missingFields.includes("targetArmor"), "Missing target armor should be reported");

assert.deepEqual(parsePublicDamageExpression("1d6 - 1"), {
  expression: "1d6-1",
  diceCount: 1,
  dieSize: 6,
  modifier: -1,
}, "Damage parser should normalize spaced subtraction");
assert.equal(JSON.stringify(fighter), fighterSnapshot, "Resolver should not mutate attacker");
assert.equal(JSON.stringify(target), targetSnapshot, "Resolver should not mutate target");

console.log("Public basic attack resolver tests passed.");
