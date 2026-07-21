import assert from "node:assert/strict";
import {
  GROUND_CONTROL_STATES,
  advanceGroundControl,
  applyAuthoritativeExhaustionCollapse,
  hasSufficientGroundControl,
  isConsciousExhaustionCollapse,
} from "../src/utils/combat/exhaustionCollapseState.js";
import {
  getPhase3B2GrappleActions,
  isGroundedGrapple,
} from "../src/utils/combat/grappleWeaponTransitions.js";
import {
  MISERICORDE_WEAPON_PROFILE,
  createClinchWeaponProfile,
  validateClinchWeaponProfile,
} from "../src/utils/combat/clinchWeaponProfiles.js";
import { resolveArmorContact } from "../src/utils/combat/armorContactResolver.js";

const dagger = { id: "dagger", name: "Dagger", category: "dagger", damage: "1d4", usableInClinch: true };
const sharedHex = { x: 4, y: 2 };
const exhaustedKnight = {
  id: "enemy-knight", name: "Enemy Knight", type: "enemy", currentHP: 10, maxHP: 30,
  canAct: true, remainingActions: 2, attacksRemaining: 2,
  fatigueState: { status: "collapse_risk", currentStamina: -20 },
  grappleState: { state: "grapple_clinch", positionState: "standing", opponent: "party-knight", sharedHex },
  equistaminadWeapons: [dagger], equipment: [{ id: "plate", name: "Plate Harness" }],
};
const controllingKnight = {
  id: "party-knight", name: "Party Knight", type: "player", currentHP: 24, maxHP: 30,
  canAct: true, remainingActions: 2, attacksRemaining: 2,
  grappleState: { state: "grapple_clinch", positionState: "standing", opponent: "enemy-knight", sharedHex },
  equistaminadWeapons: [dagger],
  combatWeaponState: { readyWeaponId: "dagger", clinchWeaponId: "dagger", clinchWeaponReady: true, droppedWeaponIds: [] },
};

const collapse = applyAuthoritativeExhaustionCollapse({
  fighters: [controllingKnight, exhaustedKnight], fighterId: exhaustedKnight.id,
  currentStamina: -15, collapseRoundsRemaining: 2, round: 3, turn: 7,
});
assert.equal(collapse.ok, true);
assert.equal(collapse.combatTerminal, false, "10 HP conscious collapse cannot end combat");
assert.equal(collapse.activeGrapplePreserved, true);
const collapsed = collapse.fighters.find((fighter) => fighter.id === exhaustedKnight.id);
const controller = collapse.fighters.find((fighter) => fighter.id === controllingKnight.id);
assert.equal(collapsed.currentHP, 10);
assert.equal(collapsed.isDead, undefined);
assert.equal(collapsed.isUnconscious, undefined);
assert.equal(collapsed.defeated, undefined);
assert.equal(collapsed.canAct, false);
assert.equal(collapsed.remainingActions, 0);
assert.equal(collapsed.prone, true);
assert.equal(isConsciousExhaustionCollapse(collapsed), true);
assert.equal(collapsed.grappleState.opponent, controller.id);
assert.equal(controller.grappleState.opponent, collapsed.id);
assert.equal(collapsed.grappleState.positionState, "ground");
assert.equal(controller.grappleState.positionState, "ground");
assert.deepEqual(collapsed.grappleState.groundControl, controller.grappleState.groundControl, "ground control must be symmetric");
assert.equal(controller.grappleState.groundControl.state, GROUND_CONTROL_STATES.DOMINANT);
assert.equal(controller.grappleState.groundControl.controllerId, controller.id);
assert.equal(isGroundedGrapple(controller, collapsed), true);
assert.equal(hasSufficientGroundControl(controller, collapsed), true);

const actions = getPhase3B2GrappleActions(controller, collapsed);
for (const action of ["holdAndRest", "secureGroundControl", "groundedArmorGapStrike", "demandSurrender"]) {
  assert.equal(actions.includes(action), true, `${action} must be a canonical grounded action`);
}
assert.equal(getPhase3B2GrappleActions(collapsed, controller).length, 0, "collapsed fighter has no actions");

const pinned = advanceGroundControl(controller, collapsed, { reason: "fixture" });
assert.equal(pinned.groundControl.state, GROUND_CONTROL_STATES.PINNED);
assert.deepEqual(pinned.fighter.grappleState.groundControl, pinned.opponent.grappleState.groundControl);

assert.equal(MISERICORDE_WEAPON_PROFILE.reservedActionType, "misericordeThrust");
const misericorde = createClinchWeaponProfile(MISERICORDE_WEAPON_PROFILE, controller);
assert.equal(validateClinchWeaponProfile(misericorde).ok, true);
assert.equal(misericorde.attackMode, "misericorde-thrust");

const intactPlate = {
  ...collapsed,
  armorProfile: { armorClass: "plate", rigidCoverage: true, gapDefenseBonus: 8, coveredLocations: ["torso"], gapLocations: ["armpit"] },
};
const solidPlateContact = resolveArmorContact({
  attacker: controller, defender: intactPlate, weapon: misericorde, attackMode: misericorde.attackMode,
  attackRoll: 12, attackTotal: 12, hitLocation: "torso", normalDefense: 12,
  targetState: { grappled: true, pinned: false },
});
assert.equal(solidPlateContact.damageAllowed, false, "grounded gap action cannot bypass intact plate without reaching a gap");

console.log("Phase 3B3A exhaustion-collapse runtime tests passed");
