import assert from "node:assert/strict";
import {
  SHIELD_AFTERMATH_ACTIONS,
  buildShieldAftermathItem,
  getShieldAftermathOptions,
  resolveShieldAftermathAction,
} from "../src/utils/aftermath/shieldAftermathAuthority.js";
import {
  applyAftermathLootAction,
  createAftermathEncounter,
} from "../src/utils/aftermath/aftermathAuthority.js";

const shieldItem = buildShieldAftermathItem({
  shield: { id: "heater", name: "Heater Shield" },
  shieldIntegrity: { shieldId: "heater", currentDurability: 4, maxDurability: 18, state: "battered" },
  sourceActorId: "fighter",
});
assert.equal(shieldItem.category, "shield");
assert.equal(shieldItem.currentDurability, 4);
assert.ok(getShieldAftermathOptions(shieldItem).some((option) => option.id === SHIELD_AFTERMATH_ACTIONS.FIELD_REPAIR));

let encounter = createAftermathEncounter({
  fighters: [{
    id: "fighter",
    name: "Shield Bearer",
    team: "enemy",
    type: "enemy",
    currentHP: 5,
    maxHP: 10,
    equippedShield: { id: "heater", name: "Heater Shield" },
    shieldIntegrity: { shieldId: "heater", name: "Heater Shield", currentDurability: 4, maxDurability: 18, state: "battered" },
  }],
  positions: { fighter: { x: 0, y: 0 } },
  endedAt: 7000,
});
encounter.lootLedger = [{ ...shieldItem, ownerName: "Shield Bearer", confiscated: true }];
encounter.supplies.repairMaterials = 3;
let result = applyAftermathLootAction(encounter, {
  itemId: shieldItem.itemId,
  action: SHIELD_AFTERMATH_ACTIONS.FIELD_REPAIR,
});
assert.equal(result.accepted, true);
encounter = result.encounter;
assert.ok(result.item.currentDurability > 4);
assert.ok(result.item.maxDurability < 18, "field repair should reduce maximum durability");

result = resolveShieldAftermathAction({
  encounter,
  itemId: shieldItem.itemId,
  action: SHIELD_AFTERMATH_ACTIONS.SALVAGE,
});
assert.equal(result.accepted, true);
assert.equal(result.encounter.lootLedger.length, 0);
assert.ok(result.encounter.supplies.repairMaterials >= 1);
console.log("shield aftermath authority test passed");
