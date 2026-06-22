import assert from "node:assert/strict";
import PUBLIC_ENEMIES from "../src/data/publicEnemies.js";
import { adaptPublicEnemyToCombatant } from "../src/utils/publicEnemyCombatAdapter.js";
import {
  clearPublicArenaRosterEntries,
  loadPublicArenaRosterEntries,
  PUBLIC_ARENA_ROSTER_STORAGE_KEY,
  savePublicArenaRosterEntries,
} from "../src/utils/publicStagedRosterStorage.js";

const storage = new Map();
global.window = {
  localStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
};

["goblin-warrior", "wolf", "brown-bear"].forEach((id) => {
  const enemy = PUBLIC_ENEMIES.find((entry) => entry.id === id);
  const snapshot = JSON.stringify(enemy);
  const conversion = adaptPublicEnemyToCombatant(enemy);

  assert.equal(conversion.ok, true, `${id} should convert to combatant shape`);
  assert.equal(conversion.combatant.name, enemy.name, `${id} should preserve name`);
  assert.equal(conversion.combatant.HP, enemy.hitPoints, `${id} should map hitPoints to HP`);
  assert.equal(conversion.combatant.guardRating, enemy.armorClass, `${id} should map armorClass to guardRating`);
  assert.equal(conversion.combatant.category, enemy.creatureType, `${id} should map creatureType to category`);
  assert.ok(Array.isArray(conversion.combatant.attacks), `${id} should include attacks`);
  assert.ok(conversion.combatant.attacks.length > 0, `${id} should include at least one attack`);
  assert.equal(JSON.stringify(enemy), snapshot, `${id} conversion should not mutate source`);
});

const missingConversion = adaptPublicEnemyToCombatant({
  id: "incomplete",
  name: "Incomplete Enemy",
  actions: [{ name: "Strike" }],
});

assert.equal(missingConversion.ok, false, "Missing enemy fields should be reported");
assert.ok(missingConversion.missingFields.includes("hitPoints"), "Missing hitPoints should be reported");
assert.ok(missingConversion.missingFields.includes("armorClass"), "Missing armorClass should be reported");
assert.ok(missingConversion.missingFields.includes("convertible actions"), "Missing convertible actions should be reported");

assert.deepEqual(loadPublicArenaRosterEntries(), [], "Empty storage should load as an empty array");
storage.set(PUBLIC_ARENA_ROSTER_STORAGE_KEY, "{not valid json");
assert.deepEqual(loadPublicArenaRosterEntries(), [], "Malformed storage should load as an empty array");
savePublicArenaRosterEntries([{ id: "test", side: "enemy" }]);
assert.deepEqual(loadPublicArenaRosterEntries(), [{ id: "test", side: "enemy" }], "Valid storage should round-trip");
clearPublicArenaRosterEntries();
assert.deepEqual(loadPublicArenaRosterEntries(), [], "Cleared storage should load as an empty array");

console.log("Public enemy combat adapter tests passed.");
