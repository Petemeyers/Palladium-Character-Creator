import assert from "node:assert/strict";
import {
  LONG_WEAPON_CLOSE_ACTIONS,
  LONG_WEAPON_CONTROL_RESPONSES,
  WEAPON_ENTRY_TECHNIQUES,
  buildLongWeaponReactionAttack,
  findSidearmCandidate,
  getLongWeaponCloseActionOptions,
  getLongWeaponControlResponseOptions,
  getWeaponEntryTechniqueOptions,
  resolveMultiOpponentMeasurePressure,
  resolveWeaponEntryExchange,
  selectAutomatedEntryTechnique,
  selectAutomatedLongWeaponCloseAction,
  selectAutomatedLongWeaponResponse,
  simulateWeaponEntryExchanges,
} from "../src/utils/combat/weaponExchangeAuthority.js";
import { analyzeMeasureAwareMovement, getEngagementAttackModifier } from "../src/utils/combat/weaponEngagementAuthority.js";

const spear = { id: "weapon.spear", name: "Spear", twoHanded: true, handsRequired: 2, reachFeet: 10, damage: "1d8" };
const sword = { id: "weapon.arming-sword", name: "Arming Sword", handsRequired: 1, reachFeet: 5, damage: "1d8" };
const dagger = { id: "weapon.dagger", name: "Dagger", handsRequired: 1, reachFeet: 5, damage: "1d4" };
const mover = { id: "sword", attributes: { deftness: 14 }, training: { weapons: {} }, behavior: { aggression: 55, caution: 60 } };
const controller = { id: "spear", attributes: { deftness: 14 }, training: { weapons: {} }, fatigueState: { currentStamina: 20, maxStamina: 30 } };

const entryOptions = getWeaponEntryTechniqueOptions({ actor: mover, weapon: sword, controllerWeapon: spear });
assert.ok(entryOptions.some((option) => option.id === WEAPON_ENTRY_TECHNIQUES.BEAT_AND_ENTER));
assert.ok(entryOptions.some((option) => option.id === WEAPON_ENTRY_TECHNIQUES.PARRY_AND_ENTER));
assert.equal(selectAutomatedEntryTechnique({ actor: mover, weapon: sword, controllerWeapon: spear }).id, WEAPON_ENTRY_TECHNIQUES.PARRY_AND_ENTER);

const responseOptions = getLongWeaponControlResponseOptions({ controller, weapon: spear, canRetreat: true });
assert.ok(responseOptions.some((option) => option.id === LONG_WEAPON_CONTROL_RESPONSES.RETREATING_THRUST));
assert.equal(selectAutomatedLongWeaponResponse({ controller, weapon: spear, canRetreat: true }).id, LONG_WEAPON_CONTROL_RESPONSES.RETREATING_THRUST);

const denial = resolveWeaponEntryExchange({
  mover,
  controller,
  moverWeapon: sword,
  controllerWeapon: spear,
  entryTechnique: WEAPON_ENTRY_TECHNIQUES.PARRY_AND_ENTER,
  controlResponse: LONG_WEAPON_CONTROL_RESPONSES.RETREATING_THRUST,
  entryRoll: 10,
  controlRoll: 10,
});
assert.equal(denial.allowed, false);
assert.equal(denial.stopThrustAuthorized, true);
assert.equal(denial.retreatFeet, 5);
assert.equal(denial.engagementState, "long-weapon-measure");

const entry = resolveWeaponEntryExchange({
  mover,
  controller,
  moverWeapon: sword,
  controllerWeapon: spear,
  entryTechnique: WEAPON_ENTRY_TECHNIQUES.BEAT_AND_ENTER,
  controlResponse: LONG_WEAPON_CONTROL_RESPONSES.STOP_THRUST,
  entryRoll: 20,
  controlRoll: 2,
});
assert.equal(entry.allowed, true);
assert.equal(entry.engagementState, "inside-the-point");

const supportedDenial = resolveWeaponEntryExchange({
  mover,
  controller,
  moverWeapon: sword,
  controllerWeapon: spear,
  entryTechnique: WEAPON_ENTRY_TECHNIQUES.RUSH_THE_POINT,
  controlResponse: LONG_WEAPON_CONTROL_RESPONSES.STOP_THRUST,
  entryRoll: 12,
  controlRoll: 8,
  supportingControllers: [{ id: "support-1" }, { id: "support-2" }],
});
assert.equal(supportedDenial.supportBonus, 2);

const interaction = analyzeMeasureAwareMovement({
  mover,
  opponent: controller,
  moverWeapon: sword,
  opponentWeapon: spear,
  beforeDistanceFt: 10,
  desiredDistanceFt: 5,
  entryRoll: 10,
  controlRoll: 10,
});
const pressure = resolveMultiOpponentMeasurePressure({
  interactions: [
    { candidate: controller, candidateWeapon: spear, desiredDistanceFt: 5, decision: interaction },
    { candidate: { ...controller, id: "support" }, candidateWeapon: spear, desiredDistanceFt: 10, decision: interaction },
  ],
});
assert.equal(pressure.primary.candidate.id, "spear");
assert.equal(pressure.controlSupportBonus, 1);


const fullSpearInside = getEngagementAttackModifier({
  attackerWeapon: spear,
  defenderWeapon: sword,
  distanceFt: 5,
});
assert.equal(fullSpearInside.modifier, -3);
assert.equal(fullSpearInside.reason, "long-weapon-inside-point");
const shortenedSpearInside = getEngagementAttackModifier({
  attackerWeapon: { ...spear, shortenedGrip: true, attackMode: "shorten-grip" },
  defenderWeapon: sword,
  distanceFt: 5,
});
assert.equal(shortenedSpearInside.modifier, -1);
assert.equal(shortenedSpearInside.reason, "long-weapon-shortened-grip-inside-point");

const reactionAttack = buildLongWeaponReactionAttack({
  weapon: spear,
  response: responseOptions.find((option) => option.id === LONG_WEAPON_CONTROL_RESPONSES.RETREATING_THRUST),
});
assert.equal(reactionAttack.techniqueKey, LONG_WEAPON_CONTROL_RESPONSES.RETREATING_THRUST);
assert.equal(reactionAttack.basicAttackStaminaCost, 1);

const sidearm = findSidearmCandidate({ fighter: { combatWeaponState: { readyWeaponId: spear.id }, inventory: [dagger, sword] } });
assert.equal(sidearm.name, "Arming Sword");
const closeOptions = getLongWeaponCloseActionOptions({ fighter: controller, weapon: spear, sidearm, canWithdraw: true });
assert.ok(closeOptions.some((option) => option.id === LONG_WEAPON_CLOSE_ACTIONS.DRAW_SIDEARM));
assert.equal(selectAutomatedLongWeaponCloseAction({ fighter: controller, weapon: spear, sidearm, canWithdraw: true }).id, LONG_WEAPON_CLOSE_ACTIONS.WITHDRAW_TO_MEASURE);

let state = 123456789;
const nextD20 = () => {
  state = (state * 1664525 + 1013904223) >>> 0;
  return (state % 20) + 1;
};
const calibration = simulateWeaponEntryExchanges({
  iterations: 5000,
  nextD20,
  mover,
  controller,
  moverWeapon: sword,
  controllerWeapon: spear,
  entryTechnique: WEAPON_ENTRY_TECHNIQUES.PARRY_AND_ENTER,
  controlResponse: LONG_WEAPON_CONTROL_RESPONSES.RETREATING_THRUST,
});
assert.ok(calibration.denialRate > 0.65, `expected spear to deny most equal-skill entries, got ${calibration.denialRate}`);
assert.equal(calibration.entries + calibration.denials, 5000);

console.log("weapon exchange authority tests passed");
