import assert from "node:assert/strict";

import { buildCombatActionCatalog } from "../src/utils/combatActionCatalog.js";

const hasFunction = (value) => {
  if (typeof value === "function") return true;
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(hasFunction);
};

const actor = {
  id: "fighter-1",
  name: "Shield Bearer",
  remainingActions: 2,
  currentStamina: 4,
  actions: true,
};
const target = { id: "target-1", name: "Raider" };
const weapon = {
  id: "weapon-1",
  name: "Shortsword",
  damage: "1d6+3",
  damageType: "piercing",
  hitBonus: 5,
  reach: "5 ft",
  onUse: () => "ignored",
};
const inventory = [
  {
    id: "bandage-1",
    name: "Linen Bandage",
    type: "supply",
    use: () => "ignored",
  },
];
const inputSnapshot = JSON.stringify({ actor, target, weaponName: weapon.name, inventoryName: inventory[0].name });

const catalog = buildCombatActionCatalog({
  actor,
  targets: [target],
  selectedTarget: target,
  equippedWeapons: [weapon],
  inventory,
  compatibilityActions: [
    { value: "Use Skill", label: "Use Skill" },
    { value: "Combat Maneuvers", label: "Maneuver" },
  ],
});

assert.ok(catalog.some((action) => action.type === "attack" && action.name === "Attack with Shortsword"), "equipped weapon creates attack action");
assert.ok(catalog.some((action) => action.type === "move" && action.name === "Move"), "move action exists");
assert.ok(catalog.some((action) => action.type === "run" && action.name === "Run"), "run action exists");
assert.ok(catalog.some((action) => action.type === "charge" && action.name === "Charge"), "charge action exists");
assert.ok(catalog.some((action) => action.type === "defend" && action.name === "Defend"), "defend action exists");
assert.ok(catalog.some((action) => action.type === "block" && action.name === "Block"), "block action exists");
assert.ok(catalog.some((action) => action.type === "evade" && action.name === "Evade"), "evade action exists");
assert.ok(catalog.some((action) => action.type === "recover" && action.name === "Catch Breath / Recover"), "recover action exists");
assert.ok(catalog.some((action) => action.type === "use-item" && action.name === "Use Item: Linen Bandage"), "inventory item creates use-item action");
assert.ok(catalog.some((action) => action.type === "use-skill" && action.name === "Use Skill"), "skill compatibility action exists");
assert.equal(catalog.some((action) => action.name === "Attack with true"), false, "boolean actions field is ignored");
assert.equal(catalog.some(hasFunction), false, "catalog actions contain no functions");

const enabledAttack = catalog.find((action) => action.name === "Attack with Shortsword");
assert.equal(enabledAttack.enabled, true, "numeric remaining actions and stamina allow weapon attack");
assert.equal(enabledAttack.costActions, 1);
assert.equal(enabledAttack.costStamina, 1);
assert.equal(enabledAttack.targetId, "target-1");

const noWeaponCatalog = buildCombatActionCatalog({
  actor: { id: "fighter-2", name: "Unarmed Fighter", remainingActions: 1, currentStamina: 1 },
  targets: [target],
  selectedTarget: target,
});
assert.ok(noWeaponCatalog.some((action) => action.type === "attack" && action.name === "Unarmed Strike"), "no weapon creates unarmed fallback");

const noActionsCatalog = buildCombatActionCatalog({
  actor: { id: "fighter-3", name: "Spent Fighter", remainingActions: 0, currentStamina: 3 },
  targets: [target],
  selectedTarget: target,
  equippedWeapons: [weapon],
});
const noActionsAttack = noActionsCatalog.find((action) => action.name === "Attack with Shortsword");
assert.equal(noActionsAttack.enabled, false, "0 remaining actions disables action-cost entries");
assert.equal(noActionsAttack.disabledReason, "No actions remaining.");

const noStaminaCatalog = buildCombatActionCatalog({
  actor: { id: "fighter-4", name: "Tired Fighter", remainingActions: 1, currentStamina: 0 },
  targets: [target],
  selectedTarget: target,
  equippedWeapons: [weapon],
});
const noStaminaAttack = noStaminaCatalog.find((action) => action.name === "Attack with Shortsword");
assert.equal(noStaminaAttack.enabled, false, "0 stamina disables stamina-cost entries");
assert.equal(noStaminaAttack.disabledReason, "No stamina remaining.");
const noStaminaDefend = noStaminaCatalog.find((action) => action.name === "Defend");
assert.equal(noStaminaDefend.enabled, true, "0 stamina does not disable zero-stamina display entries");

assert.deepEqual(buildCombatActionCatalog(), [], "missing input does not throw");
assert.doesNotThrow(() => buildCombatActionCatalog({ actor: {}, targets: "bad", inventory: true, equippedWeapons: false }));
assert.equal(JSON.stringify({ actor, target, weaponName: weapon.name, inventoryName: inventory[0].name }), inputSnapshot, "utility does not mutate inputs");

console.log("combat action catalog tests passed");
