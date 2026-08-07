import assert from "node:assert/strict";
import {
  getCanonicalWeaponTraitProfile,
  normalizeCanonicalCombatWeapon,
} from "../src/utils/combat/canonicalWeaponTraits.js";
import {
  applyPolearmSpecialActionOnHit,
  getPolearmSpecialActions,
  getReadyCombatWeapon,
  resolvePolearmCombatMatchup,
  selectAutomatedPolearmAction,
} from "../src/utils/combat/polearmCombatAuthority.js";

const spear = normalizeCanonicalCombatWeapon({
  id: "weapon.infantry-spear",
  name: "Spear",
  weaponFamily: "long-spear",
  twoHanded: true,
  handsRequired: 2,
  reachFeet: 10,
  lengthFt: 6,
});
const oneHandSword = { id: "weapon.arming-sword", name: "Arming Sword", handsRequired: 1, reachFeet: 5 };
const longsword = { id: "weapon.long-sword", name: "Long Sword", handsRequired: 1, reachFeet: 5 };
const greatsword = normalizeCanonicalCombatWeapon({ id: "weapon.greatsword", name: "Greatsword", handsRequired: 2, twoHanded: true, lengthFt: 5 });
const pike = normalizeCanonicalCombatWeapon({ id: "weapon.pike", name: "Pike", handsRequired: 2, twoHanded: true, reachFeet: 15 });
const halberd = normalizeCanonicalCombatWeapon({ id: "weapon.halberd", name: "Halberd", handsRequired: 2, twoHanded: true, reachFeet: 10 });
const oneHandSpear = normalizeCanonicalCombatWeapon({ id: "weapon.short-spear", name: "Spear", handsRequired: 1, twoHanded: false, shieldCompatible: true, reachFeet: 10 });

const actor = (weapon, shield = null, behavior = {}) => ({
  id: `${weapon.id}-actor`,
  equipment: [weapon],
  attacks: [weapon],
  combatWeaponState: { readyWeaponId: weapon.id },
  equippedShield: shield,
  behavior,
});

const noShieldSword = actor(oneHandSword);
const spearUser = actor(spear);
const bucklerSword = actor(longsword, { id: "shield.buckler", name: "Buckler", type: "shield" });
const shieldSword = actor(longsword, { id: "shield.heater", name: "Heater Shield", type: "shield" });
const greatswordUser = actor(greatsword);

let matchup = resolvePolearmCombatMatchup({
  attacker: spearUser,
  defender: noShieldSword,
  attackWeapon: spear,
  defenderWeapon: oneHandSword,
  distanceFt: 10,
});
assert.equal(matchup.attackModifier, 3, "two-handed spear should receive the 9:3 outer-measure advantage");
assert.equal(matchup.ratio, "9:3");

matchup = resolvePolearmCombatMatchup({
  attacker: noShieldSword,
  defender: spearUser,
  attackWeapon: oneHandSword,
  defenderWeapon: spear,
  distanceFt: 10,
});
assert.equal(matchup.attackModifier, -3, "one-handed weapon should suffer the inverse spear disadvantage");

matchup = resolvePolearmCombatMatchup({
  attacker: spearUser,
  defender: bucklerSword,
  attackWeapon: spear,
  defenderWeapon: longsword,
  distanceFt: 10,
});
assert.equal(matchup.attackModifier, 2, "spear vs sword and buckler should use the 4:2 advantage");
assert.equal(matchup.ratio, "4:2");

matchup = resolvePolearmCombatMatchup({
  attacker: spearUser,
  defender: shieldSword,
  attackWeapon: spear,
  defenderWeapon: longsword,
  distanceFt: 10,
});
assert.equal(matchup.attackModifier, 1, "spear vs sword and full shield should use the narrow 7:6 advantage");
assert.equal(matchup.ratio, "7:6");

matchup = resolvePolearmCombatMatchup({
  attacker: spearUser,
  defender: greatswordUser,
  attackWeapon: spear,
  defenderWeapon: greatsword,
  distanceFt: 10,
});
assert.equal(matchup.attackModifier, 2, "spear should begin with a 4:2 advantage over a greatsword at measure");

matchup = resolvePolearmCombatMatchup({
  attacker: greatswordUser,
  defender: spearUser,
  attackWeapon: greatsword,
  defenderWeapon: spear,
  distanceFt: 10,
  selectedTechnique: "half-sword-thrust",
});
assert.equal(matchup.attackModifier, 0, "half-sword entry should remove the default spear matchup penalty");

const spearShield = actor(oneHandSpear, { id: "shield.round", name: "Round Shield", type: "shield" });
matchup = resolvePolearmCombatMatchup({
  attacker: spearShield,
  defender: shieldSword,
  attackWeapon: oneHandSpear,
  defenderWeapon: longsword,
  distanceFt: 10,
});
assert.equal(matchup.attackModifier, -1, "one-handed spear and shield should be disadvantaged against sword and shield");

const pikeUser = actor(pike);
const pikeSupported = resolvePolearmCombatMatchup({
  attacker: pikeUser,
  defender: noShieldSword,
  attackWeapon: pike,
  defenderWeapon: oneHandSword,
  distanceFt: 15,
  formationSupported: true,
});
const pikeIsolated = resolvePolearmCombatMatchup({
  attacker: pikeUser,
  defender: noShieldSword,
  attackWeapon: pike,
  defenderWeapon: oneHandSword,
  distanceFt: 15,
  formationSupported: false,
});
assert.ok(pikeSupported.attackModifier > pikeIsolated.attackModifier, "pikes should gain extra authority in formation");
const pikeClose = resolvePolearmCombatMatchup({
  attacker: pikeUser,
  defender: noShieldSword,
  attackWeapon: pike,
  defenderWeapon: oneHandSword,
  distanceFt: 5,
});
assert.ok(pikeClose.attackModifier <= -4, "pikes should be severely penalized inside their point");

const halberdUser = actor(halberd);
const halberdClose = resolvePolearmCombatMatchup({
  attacker: halberdUser,
  defender: noShieldSword,
  attackWeapon: halberd,
  defenderWeapon: oneHandSword,
  distanceFt: 5,
});
assert.ok(halberdClose.attackModifier > pikeClose.attackModifier, "halberds should remain more usable at close range than pikes");

const actions = getPolearmSpecialActions({ attackerWeapon: greatsword, defenderWeapon: spear, distanceFt: 10 });
assert.ok(actions.some((entry) => entry.id === "polearm-beat-entry" && entry.legal));
assert.ok(actions.some((entry) => entry.id === "shaft-cut" && entry.legal));

const cautiousChoice = selectAutomatedPolearmAction({
  attacker: actor(greatsword, null, { aggression: 50 }),
  defender: spearUser,
  attackerWeapon: greatsword,
  defenderWeapon: spear,
  distanceFt: 10,
});
assert.equal(cautiousChoice.id, "polearm-beat-entry");
const aggressiveChoice = selectAutomatedPolearmAction({
  attacker: actor(greatsword, null, { aggression: 75 }),
  defender: spearUser,
  attackerWeapon: greatsword,
  defenderWeapon: spear,
  distanceFt: 10,
});
assert.equal(aggressiveChoice.id, "shaft-cut");

const shaftDamage = applyPolearmSpecialActionOnHit({
  attacker: greatswordUser,
  defender: spearUser,
  defenderWeapon: { ...spear, shaftIntegrity: 3, maxShaftIntegrity: 3 },
  selectedTechnique: "shaft-cut",
  currentRound: 2,
});
assert.equal(shaftDamage.applied, true);
assert.equal(shaftDamage.nextIntegrity, 2);
assert.equal(shaftDamage.effect, "polearm-shaft-damaged");

const entry = applyPolearmSpecialActionOnHit({
  attacker: greatswordUser,
  defender: spearUser,
  defenderWeapon: spear,
  selectedTechnique: "polearm-beat-entry",
  currentRound: 2,
});
assert.equal(entry.applied, true);
assert.equal(entry.defenderPatch.polearmDisplacedUntilRound, 3);


const brokenSpearUser = actor({ ...spear, broken: true, unusable: true });
assert.equal(getReadyCombatWeapon(brokenSpearUser), null, "broken polearms must not remain ready weapons");

const spearTraits = getCanonicalWeaponTraitProfile(spear);
assert.equal(spearTraits.isTwoHandedSpear, true);
assert.equal(spearTraits.shaftDestructible, true);
assert.equal(getCanonicalWeaponTraitProfile(pike).formationDependent, true);
assert.equal(getCanonicalWeaponTraitProfile(halberd).canHook, true);
assert.equal(getCanonicalWeaponTraitProfile(greatsword).canTargetShaft, true);

console.log("polearm combat authority regression: passed");
