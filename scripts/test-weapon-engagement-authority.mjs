import assert from "node:assert/strict";
import {
  WEAPON_ENGAGEMENT_MEASURES,
  analyzeMeasureAwareMovement,
  getEngagementAttackModifier,
  getPreferredEngagementDistanceFeet,
  getWeaponTacticalTraits,
  markCombatExertion,
  resolvePassiveRoundStaminaRecovery,
  resolveWeaponActionStaminaCost,
  resolveWeaponEngagementMeasure,
} from "../src/utils/combat/weaponEngagementAuthority.js";

const spear = {
  id: "weapon.spear",
  name: "Spear",
  twoHanded: true,
  handsRequired: 2,
  reachFeet: 10,
};
const sword = {
  id: "weapon.arming-sword",
  name: "Arming Sword",
  handsRequired: 1,
  reachFeet: 5,
};
const equalActor = {
  attributes: { deftness: 14 },
  training: { weapons: {} },
  proficiencyBonus: 0,
};

const spearTraits = getWeaponTacticalTraits(spear);
const swordTraits = getWeaponTacticalTraits(sword);
assert.equal(spearTraits.primaryDelivery, "thrust");
assert.equal(spearTraits.pointControl, 3);
assert.equal(spearTraits.entryDenial, 3);
assert.equal(spearTraits.preferredDistanceFeet, 10);
assert.equal(swordTraits.entryAbility, 2);
assert.equal(swordTraits.closeHandling, 2);

assert.equal(
  resolveWeaponEngagementMeasure({ distanceFt: 10, attackerWeapon: spear, defenderWeapon: sword }),
  WEAPON_ENGAGEMENT_MEASURES.LONG_WEAPON,
);
assert.equal(
  resolveWeaponEngagementMeasure({ distanceFt: 5, attackerWeapon: spear, defenderWeapon: sword }),
  WEAPON_ENGAGEMENT_MEASURES.INSIDE_POINT,
);
assert.equal(getPreferredEngagementDistanceFeet({ actorWeapon: spear, opponentWeapon: sword }), 10);

const maintain = analyzeMeasureAwareMovement({
  mover: equalActor,
  opponent: equalActor,
  moverWeapon: spear,
  opponentWeapon: sword,
  beforeDistanceFt: 15,
  desiredDistanceFt: 5,
  movementAction: "MOVE",
  entryRoll: 10,
  controlRoll: 10,
});
assert.equal(maintain.type, "maintain-measure");
assert.equal(maintain.preferredDistanceFeet, 10);

const deniedEntry = analyzeMeasureAwareMovement({
  mover: equalActor,
  opponent: equalActor,
  moverWeapon: sword,
  opponentWeapon: spear,
  beforeDistanceFt: 10,
  desiredDistanceFt: 5,
  movementAction: "MOVE",
  entryRoll: 10,
  controlRoll: 10,
});
assert.equal(deniedEntry.type, "entry-contest");
assert.equal(deniedEntry.allowed, false);
assert.ok(deniedEntry.controlScore > deniedEntry.entryScore);

const successfulEntry = analyzeMeasureAwareMovement({
  mover: equalActor,
  opponent: equalActor,
  moverWeapon: sword,
  opponentWeapon: spear,
  beforeDistanceFt: 10,
  desiredDistanceFt: 5,
  movementAction: "MOVE",
  entryRoll: 20,
  controlRoll: 2,
});
assert.equal(successfulEntry.allowed, true);
assert.equal(successfulEntry.outcome, "critical-entry");

const spearInside = getEngagementAttackModifier({ attackerWeapon: spear, defenderWeapon: sword, distanceFt: 5 });
const swordInside = getEngagementAttackModifier({ attackerWeapon: sword, defenderWeapon: spear, distanceFt: 5 });
assert.equal(spearInside.modifier, -3, "full-length spear should be penalized after entry");
assert.equal(swordInside.modifier, 3, "short sword should gain close handling after entry");

const spearStamina = resolveWeaponActionStaminaCost({
  fighter: equalActor,
  weapon: { ...spear, staminaCost: 3 },
  actionType: "melee",
  fallbackCost: 3,
});
const swordStamina = resolveWeaponActionStaminaCost({
  fighter: equalActor,
  weapon: sword,
  actionType: "melee",
  fallbackCost: 1,
});
assert.equal(spearStamina.cost, 1, "legacy weapon weight cost must not triple an ordinary spear thrust");
assert.equal(swordStamina.cost, 1);
assert.equal(resolveWeaponActionStaminaCost({ weapon: spear, technique: "committed power thrust", fallbackCost: 3 }).cost, 2);

const freshFighter = {
  fatigueState: { currentStamina: 20, maxStamina: 30 },
  combatExertion: { round: 8, intense: false },
};
assert.equal(resolvePassiveRoundStaminaRecovery({ fighter: freshFighter, completedRound: 8 }).amount, 1);
const sprinted = markCombatExertion({ fighter: freshFighter, actionType: "SPRINT", source: "sprint", round: 8 });
assert.equal(resolvePassiveRoundStaminaRecovery({ fighter: sprinted, completedRound: 8 }).amount, 0);

console.log("weapon engagement authority tests passed");
