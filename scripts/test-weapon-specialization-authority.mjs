import assert from "node:assert/strict";
import {
  applySpecializedWeaponActionToAttack,
  buildWeaponMeasurePresentation,
  getPersistentSupportingControllers,
  getSpecializedWeaponActionOptions,
  getSpecializedWeaponAttackModifier,
  reconcilePersistentWeaponControlStates,
  resolveSpecializedWeaponEffectOnHit,
  selectAutomatedSpecializedWeaponAction,
  SPECIALIZED_WEAPON_ACTIONS,
  upsertPersistentWeaponControlState,
} from "../src/utils/combat/weaponSpecializationAuthority.js";
import {
  getWeaponEntryTechniqueOptions,
  WEAPON_ENTRY_TECHNIQUES,
} from "../src/utils/combat/weaponExchangeAuthority.js";

const spear = {
  id: "weapon.spear",
  name: "Spear",
  reachFeet: 10,
  reach: 10,
  handsRequired: 2,
  twoHanded: true,
  shaftDestructible: true,
};
const pike = {
  id: "weapon.pike",
  name: "Pike",
  reachFeet: 15,
  reach: 15,
  handsRequired: 2,
  twoHanded: true,
  shaftDestructible: true,
};
const halberd = {
  id: "weapon.halberd",
  name: "Halberd",
  reachFeet: 10,
  reach: 10,
  handsRequired: 2,
  twoHanded: true,
  shaftDestructible: true,
};
const armingSword = {
  id: "weapon.arming-sword",
  name: "Arming Sword",
  reachFeet: 5,
  reach: 5,
  handsRequired: 1,
};
const longsword = {
  id: "weapon.longsword",
  name: "Longsword",
  reachFeet: 5,
  reach: 5,
  handsRequired: 2,
  twoHanded: true,
  halfSwordCapable: true,
};
const greatsword = {
  id: "weapon.greatsword",
  name: "Greatsword",
  reachFeet: 6,
  reach: 6,
  handsRequired: 2,
  twoHanded: true,
  halfSwordCapable: true,
};
const actor = {
  id: "actor",
  name: "Actor",
  team: "party",
  attributes: { deftness: 14 },
  proficiencyBonus: 2,
  fatigueState: { currentStamina: 30, maxStamina: 30 },
};
const target = {
  id: "target",
  name: "Target",
  team: "enemy",
  attributes: { deftness: 14 },
  proficiencyBonus: 2,
  fatigueState: { currentStamina: 30, maxStamina: 30 },
};

const halfSwordEntry = getWeaponEntryTechniqueOptions({
  actor,
  weapon: longsword,
  controllerWeapon: spear,
});
assert.ok(
  halfSwordEntry.some((option) => option.id === WEAPON_ENTRY_TECHNIQUES.HALF_SWORD_ENTRY),
  "a half-sword-capable longsword must expose Half-Sword Entry against a polearm",
);

const greatswordOptions = getSpecializedWeaponActionOptions({
  actor,
  weapon: greatsword,
  opponent: target,
  opponentWeapon: spear,
  distanceFt: 10,
});
assert.ok(greatswordOptions.some((option) => option.id === SPECIALIZED_WEAPON_ACTIONS.GREATSWORD_BEAT_ASIDE));
assert.ok(greatswordOptions.some((option) => option.id === SPECIALIZED_WEAPON_ACTIONS.GREATSWORD_CUT_SHAFT));

const pikeOptions = getSpecializedWeaponActionOptions({
  actor,
  weapon: pike,
  opponent: target,
  opponentWeapon: armingSword,
  distanceFt: 15,
  formationSupported: true,
});
const setPike = pikeOptions.find((option) => option.id === SPECIALIZED_WEAPON_ACTIONS.PIKE_SET_POINT);
assert.ok(setPike, "pike must expose Set the Pike at long measure");
assert.ok(setPike.controlModifier >= 5, "formation support must strengthen pike control");

const halberdCloseOptions = getSpecializedWeaponActionOptions({
  actor,
  weapon: halberd,
  opponent: target,
  opponentWeapon: armingSword,
  distanceFt: 5,
});
assert.ok(halberdCloseOptions.some((option) => option.id === SPECIALIZED_WEAPON_ACTIONS.HALBERD_HEAVY_CHOP));
assert.ok(halberdCloseOptions.some((option) => option.id === SPECIALIZED_WEAPON_ACTIONS.HALBERD_HOOK_AND_DRAW));

const autoGreatsword = selectAutomatedSpecializedWeaponAction({
  actor: { ...actor, behavior: { aggression: 80, caution: 20 } },
  weapon: greatsword,
  opponent: target,
  opponentWeapon: spear,
  distanceFt: 10,
});
assert.equal(autoGreatsword?.id, SPECIALIZED_WEAPON_ACTIONS.GREATSWORD_CUT_SHAFT);

const applied = applySpecializedWeaponActionToAttack({ attack: greatsword, action: autoGreatsword });
assert.equal(applied.specializedWeaponActionId, SPECIALIZED_WEAPON_ACTIONS.GREATSWORD_CUT_SHAFT);
assert.equal(applied.basicAttackStaminaCost, 2);

const halberdModifier = getSpecializedWeaponAttackModifier({
  actionId: SPECIALIZED_WEAPON_ACTIONS.HALBERD_HEAVY_CHOP,
  attackerWeapon: halberd,
  defenderWeapon: armingSword,
  distanceFt: 5,
});
assert.equal(halberdModifier.applies, true);
assert.ok(halberdModifier.modifier >= 1);

const hookEffect = resolveSpecializedWeaponEffectOnHit({
  actionId: SPECIALIZED_WEAPON_ACTIONS.HALBERD_HOOK_AND_DRAW,
  attacker: actor,
  defender: target,
  currentRound: 4,
});
assert.equal(hookEffect.effect, "halberd-hook-off-balance");
assert.equal(hookEffect.defenderPatch.statusEffects[0].penalties.defense, -1);

const registry = new Map();
upsertPersistentWeaponControlState(registry, {
  controllerId: "spear-a",
  targetId: "sword",
  measure: "long-weapon-measure",
  currentRound: 3,
});
upsertPersistentWeaponControlState(registry, {
  controllerId: "spear-b",
  targetId: "sword",
  measure: "long-weapon-measure",
  currentRound: 3,
});
const supportActors = [
  { ...actor, id: "spear-a" },
  { ...actor, id: "spear-b" },
  { ...target, id: "sword" },
];
const supporters = getPersistentSupportingControllers(registry, {
  targetId: "sword",
  excludeControllerId: "spear-a",
  combatants: supportActors,
});
assert.deepEqual(supporters.map((entry) => entry.id), ["spear-b"]);

const geometryRegistry = new Map();
const combatants = [
  { ...actor, id: "spear-a", team: "party", selectedAttack: spear },
  { ...target, id: "sword", team: "enemy", selectedAttack: armingSword },
];
const positions = {
  "spear-a": { x: 5, y: 5 },
  sword: { x: 7, y: 5 },
};
const states = reconcilePersistentWeaponControlStates(geometryRegistry, {
  combatants,
  positions,
  currentRound: 2,
  getWeapon: (fighter) => fighter.selectedAttack,
});
assert.equal(states.length, 1);
assert.equal(states[0].controllerId, "spear-a");
const presentation = buildWeaponMeasurePresentation({
  combatants,
  positions,
  selectedActorId: "spear-a",
  targetActorId: "sword",
  controlStates: states,
});
assert.equal(presentation.overlays.length, 1);
assert.equal(presentation.threatLines.length, 1);

console.log("weapon specialization authority tests passed");
