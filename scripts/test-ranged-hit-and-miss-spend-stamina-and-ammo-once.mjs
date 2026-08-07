import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const combatPage = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(combatPage, /attack-roll-pre-stamina/);
assert.match(combatPage, /spends \$\{attackStamina\.spent\} stamina attacking with/);
assert.match(combatPage, /const staminaChargeKey = `\$\{combatSessionRef\.current\}:\$\{String\(/);
assert.match(combatPage, /staminaChargedAttackKeysRef\.current\.add\(staminaChargeKey\)/);
assert.match(combatPage, /staminaChargedAttackKeysRef\.current\.has\(staminaChargeKey\)/);
assert.match(combatPage, /spendAmmunitionOnce\(\{/);
assert.match(combatPage, /canonicalAmmunitionRegistryRef\.current/);
assert.match(combatPage, /projectileAuthorized/);
assert.doesNotMatch(combatPage, /setAmmoOverrides\(/);

const staminaHasIndex = combatPage.indexOf("staminaChargedAttackKeysRef.current.has(staminaChargeKey)");
const staminaAddIndex = combatPage.indexOf("staminaChargedAttackKeysRef.current.add(staminaChargeKey)", staminaHasIndex);
const rollIndex = combatPage.indexOf("attackRollResult = CryptoSecureDice.parseAndRoll", staminaAddIndex);
assert.ok(staminaHasIndex !== -1 && staminaAddIndex !== -1 && staminaHasIndex < staminaAddIndex);
assert.ok(rollIndex !== -1 && staminaAddIndex < rollIndex, "stamina should be charged before hit/miss resolution");

console.log("ranged hit and miss paths use canonical stamina and ammunition transactions");
