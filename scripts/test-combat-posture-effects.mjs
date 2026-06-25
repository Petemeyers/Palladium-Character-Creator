import assert from "node:assert/strict";

import { applyArmorMitigation } from "../src/utils/combatArmor.js";
import { createCombatPosture } from "../src/utils/combatPosture.js";
import {
  applyPostureEffectsToAttackPreview,
  applyPostureEffectsToDamage,
  getPostureDamageReduction,
  getPostureDefenseModifier,
  getPostureEffect,
} from "../src/utils/combatPostureEffects.js";

const defendingTarget = {
  id: "target-defend",
  name: "Mimi",
  combatPosture: createCombatPosture({ type: "defending", round: 1, turnIndex: 0 }),
};
const evadingTarget = {
  id: "target-evade",
  name: "Mimi",
  combatPosture: createCombatPosture({ type: "evading", round: 1, turnIndex: 0 }),
};
const blockingTarget = {
  id: "target-block",
  name: "Mimi",
  armorReduction: 1,
  combatPosture: createCombatPosture({ type: "blocking", round: 1, turnIndex: 0 }),
};
const noPostureTarget = { id: "target-none", name: "Mimi" };
const malformedTarget = { id: "bad", combatPosture: "not an object" };
const unknownPostureTarget = {
  id: "unknown",
  combatPosture: {
    type: "sidestepping",
    label: "Sidestepping",
  },
};
const blockingSnapshot = JSON.stringify(blockingTarget);

assert.equal(getPostureDefenseModifier(defendingTarget), 2, "defending gives +2 defense");
assert.equal(getPostureDefenseModifier(evadingTarget), 2, "evading gives +2 defense");
assert.equal(getPostureDamageReduction(blockingTarget), 2, "blocking gives 2 damage reduction");
assert.equal(getPostureDefenseModifier(noPostureTarget), 0, "no posture gives no defense modifier");
assert.equal(getPostureDamageReduction(noPostureTarget), 0, "no posture gives no damage reduction");

const defendingPreview = applyPostureEffectsToAttackPreview({
  target: defendingTarget,
  attackPreview: { targetArmor: 14 },
});
assert.equal(defendingPreview.baseTargetArmor, 14, "base target number is preserved");
assert.equal(defendingPreview.targetArmor, 16, "defending raises target number by 2");
assert.equal(defendingPreview.finalTargetArmor, 16, "final target number is display-safe");
assert.equal(defendingPreview.postureEffect.message, "Target is Defending: +2 defense.");

const evadingPreview = applyPostureEffectsToAttackPreview({
  target: evadingTarget,
  attackPreview: { targetArmor: 14 },
});
assert.equal(evadingPreview.targetArmor, 16, "evading raises target number by 2");
assert.equal(evadingPreview.postureEffect.message, "Target is Evading: +2 defense.");

const armorResult = applyArmorMitigation({
  target: blockingTarget,
  attack: { name: "Sword Cut" },
  rawDamage: 6,
});
assert.equal(armorResult.finalDamage, 5, "armor mitigation remains unchanged before posture layer");

const blockedDamage = applyPostureEffectsToDamage({
  target: blockingTarget,
  rawDamage: armorResult.rawDamage,
  armorReduction: armorResult.armorReduction,
  finalDamage: armorResult.finalDamage,
});
assert.equal(blockedDamage.armorFinalDamage, 5, "posture helper preserves post-armor damage");
assert.equal(blockedDamage.postureDamageReduction, 2, "blocking reports 2 posture reduction");
assert.equal(blockedDamage.finalDamage, 3, "blocking reduces final damage after armor");
assert.equal(blockedDamage.message, "Target is Blocking: -2 final damage.");

const lowDamageBlock = applyPostureEffectsToDamage({
  target: blockingTarget,
  rawDamage: 1,
  armorReduction: 0,
  finalDamage: 1,
});
assert.equal(lowDamageBlock.finalDamage, 0, "blocking cannot reduce final damage below 0");

assert.doesNotThrow(() => getPostureEffect(null), "null target does not throw");
assert.doesNotThrow(() => getPostureEffect(malformedTarget), "malformed posture does not throw");
assert.doesNotThrow(() => getPostureEffect(unknownPostureTarget), "unknown posture does not throw");
assert.deepEqual(getPostureEffect(unknownPostureTarget), {
  postureType: "",
  postureLabel: "",
  defenseModifier: 0,
  damageReduction: 0,
  message: "",
}, "unknown posture gives no visible modifier");

const displaySafe = getPostureEffect(blockingTarget);
assert.equal(typeof displaySafe.postureType, "string", "posture type is display-safe");
assert.equal(typeof displaySafe.postureLabel, "string", "posture label is display-safe");
assert.equal(typeof displaySafe.defenseModifier, "number", "defense modifier is display-safe");
assert.equal(typeof displaySafe.damageReduction, "number", "damage reduction is display-safe");
assert.equal(typeof displaySafe.message, "string", "message is display-safe");
assert.equal(Object.values(displaySafe).some((value) => value && typeof value === "object"), false, "helper does not expose raw objects");
assert.equal(JSON.stringify(blockingTarget), blockingSnapshot, "posture effect helper does not mutate input");

console.log("combat posture effect tests passed");
