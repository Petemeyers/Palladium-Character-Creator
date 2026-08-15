import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { spendCombatStamina } from "../src/utils/combatStamina.js";
import { resolveWeaponActionStaminaCost } from "../src/utils/combat/weaponEngagementAuthority.js";
import {
  CHARGE_CATALOG_MOVEMENT_STAMINA_COST,
  CHARGE_FOLLOW_THROUGH_SOURCE,
  applyCanonicalCatalogMovementStaminaSpend,
  applyChargeFollowThroughStaminaSpend,
  readActiveStaminaAliases,
  resolveChargeCombinedActionStaminaCosts,
} from "../src/utils/combat/chargeCombinedActionStamina.js";

const longSword = { name: "Long Sword", damage: "1d8", damageType: "slashing" };

const makeFighter = (id, stamina = 28) => ({
  id,
  name: id,
  currentStamina: stamina,
  currentstamina: stamina,
  maxStamina: stamina,
  stamina,
  combatStamina: {
    authority: "combat-stamina",
    maxStamina: stamina,
    current: stamina,
    currentStamina: stamina,
  },
  fatigueState: { maxStamina: stamina, currentStamina: stamina },
  fatigueLabel: "Fresh",
  controlMode: "manual",
});

const costs = resolveChargeCombinedActionStaminaCosts({
  fighter: makeFighter("charger"),
  weapon: longSword,
});
assert.equal(CHARGE_CATALOG_MOVEMENT_STAMINA_COST, 1);
assert.equal(costs.movementCost, 1, "catalog Charge movement stamina is 1");
assert.equal(costs.followThroughAttackCost, 2, "charge-follow-through is a committed attack costing 2");
assert.equal(costs.totalCost, 3, "canonical Charge total is movement 1 + committed attack 2");
assert.equal(
  resolveWeaponActionStaminaCost({
    weapon: longSword,
    actionType: "attack",
    source: CHARGE_FOLLOW_THROUGH_SOURCE,
    fallbackCost: 2,
  }).cost,
  2,
);

const start = makeFighter("charger", 28);
const afterMove = applyCanonicalCatalogMovementStaminaSpend({
  fighter: start,
  amount: costs.movementCost,
  source: "charge-catalog-movement",
});
assert.equal(afterMove.accepted, true);
assert.equal(afterMove.spent, 1);
assert.equal(afterMove.nextStamina, 27);
assert.equal(afterMove.updated.combatStamina.currentStamina, 27, "movement must write canonical combatStamina");
assert.equal(afterMove.aliases.currentStamina, 27);
assert.equal(afterMove.aliases.agree, true, "aliases must agree after movement");

const afterAttack = applyChargeFollowThroughStaminaSpend({
  fighter: afterMove.updated,
  weapon: longSword,
  originControlMode: "manual",
});
assert.equal(afterAttack.accepted, true);
assert.equal(afterAttack.spent, 2);
assert.equal(afterAttack.nextStamina, 25);
assert.equal(afterAttack.updated.combatStamina.currentStamina, 25);
assert.equal(afterAttack.aliases.currentStamina, 25);
assert.equal(afterAttack.aliases.currentstamina, 25);
assert.equal(afterAttack.aliases.stamina, 25);
assert.equal(afterAttack.aliases.agree, true, "aliases must agree after follow-through");
assert.equal(start.combatStamina.currentStamina - afterAttack.nextStamina, 3);

const overwritten = spendCombatStamina({
  fighter: {
    ...start,
    currentStamina: 27,
    currentstamina: 27,
    stamina: 27,
  },
  amount: 2,
  reason: "attack",
});
assert.equal(overwritten.nextStamina, 26, "alias-only movement patch is the old overwrite: canonical still 28, attack writes 26");
assert.notEqual(overwritten.nextStamina, 25);

const autoplay = applyChargeFollowThroughStaminaSpend({
  fighter: afterMove.updated,
  weapon: longSword,
  originControlMode: "autoplay",
});
const ai = applyChargeFollowThroughStaminaSpend({
  fighter: afterMove.updated,
  weapon: longSword,
  originControlMode: "ai",
});
assert.equal(autoplay.spent, afterAttack.spent);
assert.equal(ai.spent, afterAttack.spent);
assert.equal(autoplay.nextStamina, afterAttack.nextStamina);
assert.equal(ai.nextStamina, afterAttack.nextStamina);

const walk = applyCanonicalCatalogMovementStaminaSpend({
  fighter: makeFighter("walker", 28),
  amount: 0,
  source: "walk-catalog",
});
assert.equal(walk.skipped, true);
assert.equal(walk.updated.combatStamina.currentStamina, 28, "Walk catalog stamina remains 0");

const staleKeys = new Set();
const firstFollowThroughKey = "charge-follow-through:cast-1";
staleKeys.add(firstFollowThroughKey);
assert.equal(staleKeys.has(firstFollowThroughKey), true);
assert.equal(staleKeys.has("charge-follow-through:stale"), false);

const combatPage = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const syncStart = combatPage.indexOf("const syncSelectedMovementCommandCost = useCallback");
const syncEnd = combatPage.indexOf("const resolveMoveMode = useCallback", syncStart);
assert.ok(syncStart >= 0 && syncEnd > syncStart);
const syncBlock = combatPage.slice(syncStart, syncEnd);
assert.match(syncBlock, /applyCanonicalCatalogMovementStaminaSpend\(/);
assert.match(syncBlock, /spend: spendCombatStamina/);
assert.doesNotMatch(syncBlock, /spendStamina\(liveFighter, staminaCost\)/);
assert.doesNotMatch(
  syncBlock,
  /maxStamina: staminaResult\.maxStamina,\s*currentStamina: staminaResult\.currentStamina,\s*fatigueLabel: staminaResult\.fatigueLabel,/,
);
assert.match(combatPage, /source: "charge-follow-through"/);
assert.match(combatPage, /staminaChargedAttackKeysRef/);
assert.doesNotMatch(
  combatPage.slice(combatPage.indexOf("if (e.type === \"HEAL\""), combatPage.indexOf("// Handle attack resolution events")),
  /currentHP:\s*newHP,\s*hp:\s*newHP/,
);

console.log("charge canonical stamina accounting: movement 1 + committed attack 2 = 3, aliases agree, no overwrite");
