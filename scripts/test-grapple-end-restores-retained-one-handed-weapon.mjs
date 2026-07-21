import assert from "node:assert/strict";
import { restoreRetainedWeaponAfterGrapple } from "../src/utils/combat/grappleWeaponTransitions.js";

const sword = { id: "long-sword", weaponId: "long-sword", name: "Long Sword", damage: "1d8 + 2", damageType: "slashing" };
const attacker = {
  id: "attacker",
  equistaminadWeapons: [sword],
  attacks: [{ name: "Unarmed Attack", damage: "1d3", isFallbackUnarmed: true }],
  combatWeaponState: {
    readyWeaponId: null,
    retainedWeaponId: "long-sword",
    retainedWeaponDisposition: "retained-unusable-in-clinch",
    clinchWeaponId: null,
    clinchWeaponReady: false,
    droppedWeaponIds: [],
  },
  grappleState: { state: "grapple_clinch", opponent: "defender", grappleId: "g1" },
};
const restored = restoreRetainedWeaponAfterGrapple({
  ...attacker,
  grappleState: { ...attacker.grappleState, state: "neutral", opponent: null },
}, { reason: "routing" });
assert.equal(restored.grappleState.state, "neutral");
assert.equal(restored.combatWeaponState.readyWeaponId, "long-sword");
assert.equal(restored.combatWeaponState.retainedWeaponId, null);
assert.equal(restored.equistaminadWeapons[0].name, "Long Sword");
assert.equal(restored.selectedWeapon.name, "Long Sword");
assert.equal(restored.attacks[0].name, "Long Sword");
console.log("grapple end restores retained one-handed weapon test passed");
