import assert from "node:assert/strict";

import {
  ensureConfiguredStartingAmmo,
  getInventoryAmmoCount,
} from "../src/utils/combatAmmoManager.js";
import { getSelectableActorAttackForDistance } from "../src/utils/selectableActorAdapter.js";

const makeArcher = (id, inventory = [{ name: "Bow", type: "ranged" }, { name: "Knife", type: "melee" }]) => ({
  id,
  name: "Archer",
  aiRole: "ranged",
  inventory,
  attacks: [
    {
      name: "Bow Shot",
      kind: "ranged",
      type: "ranged",
      attackType: "ranged",
      ammunition: "arrows",
      range: 120,
      rangeProfile: { normal: 120, long: 480 },
      damage: "1d6+2",
    },
    {
      name: "Knife Attack",
      kind: "melee",
      type: "melee",
      attackType: "melee",
      reach: 5,
      damage: "1d4",
    },
  ],
});

const archerA = ensureConfiguredStartingAmmo(makeArcher("archer-a"), { source: "test" });
const archerB = ensureConfiguredStartingAmmo(makeArcher("archer-b"), { source: "test" });

assert.equal(getInventoryAmmoCount(archerA, "arrows"), 20, "cloned Archer A gets independent starting arrows");
assert.equal(getInventoryAmmoCount(archerB, "arrows"), 20, "cloned Archer B gets independent starting arrows");
assert.notEqual(archerA.inventory, archerB.inventory, "cloned ammo inventories are independent arrays");

const customized = ensureConfiguredStartingAmmo(
  makeArcher("custom-archer", [
    { name: "Bow", type: "ranged" },
    { name: "arrows", type: "ammunition", quantity: 7 },
  ]),
  { source: "test", preserveExisting: true },
);
assert.equal(getInventoryAmmoCount(customized, "arrows"), 7, "customized ammo is preserved");

const rangedAt90 = getSelectableActorAttackForDistance(
  archerA,
  90,
  archerA.attacks[1],
  { canUseAttack: (attack) => !attack.ammunition || getInventoryAmmoCount(archerA, attack.ammunition) > 0 },
);
assert.equal(rangedAt90.name, "Bow Shot", "Archer at 90ft recognizes legal 120ft bow shot");

const emptyArcher = makeArcher("empty-archer", [
  { name: "Bow", type: "ranged" },
  { name: "arrows", type: "ammunition", quantity: 0 },
]);
const fallbackWithoutAmmo = getSelectableActorAttackForDistance(
  emptyArcher,
  90,
  emptyArcher.attacks[1],
  { canUseAttack: (attack) => !attack.ammunition || getInventoryAmmoCount(emptyArcher, attack.ammunition) > 0 },
);
assert.equal(fallbackWithoutAmmo.name, "Knife Attack", "ranged attack is not selected when arrows are unavailable");

console.log("✅ archer ammo initialization and ranged recognition tests passed");
