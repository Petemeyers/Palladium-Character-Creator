import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const combatPageSource = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(combatPageSource, /attackExecutionGateChainsRef = useRef\(new Map\(\)\)/);
assert.match(combatPageSource, /attack execution gate chain: actor=/);
assert.match(combatPageSource, /missing-entry-gate/);
assert.match(combatPageSource, /missing-pre-stamina-gate/);
assert.match(combatPageSource, /missing-roll-gate/);
assert.match(combatPageSource, /missing-damage-gate/);

assert.match(combatPageSource, /const requiresEntryGate = phase !== "attack-entry-pre-roll"/);
assert.match(combatPageSource, /const requiresPreStaminaGate = \[/);
assert.match(combatPageSource, /const requiresRollGate = \[/);
assert.match(combatPageSource, /const requiresDamageGate = phase === "hp-mutation"/);

const entryMarkIndex = combatPageSource.indexOf('markAttackGateChain("entry")');
const preStaminaMarkIndex = combatPageSource.indexOf('markAttackGateChain("preStamina")');
const rollMarkIndex = combatPageSource.indexOf('markAttackGateChain("roll")');
const damageMarkIndex = combatPageSource.indexOf('markAttackGateChain("damage")');
const hpMarkIndex = combatPageSource.indexOf('markAttackGateChain("hp")');
assert.ok(entryMarkIndex !== -1, "valid attacks must mark entry gate");
assert.ok(preStaminaMarkIndex !== -1, "valid attacks must mark pre-stamina gate");
assert.ok(rollMarkIndex !== -1, "valid attacks must mark roll gate");
assert.ok(damageMarkIndex !== -1, "valid attacks must mark damage gate");
assert.ok(hpMarkIndex !== -1, "valid attacks must mark hp gate");

const rollGateValidationIndex = combatPageSource.indexOf('source: "attack-roll"');
const missingEntryIndex = combatPageSource.indexOf("missing-entry-gate");
assert.ok(
  rollGateValidationIndex !== -1 && missingEntryIndex !== -1,
  "attack-roll validation must be able to reject missing entry gate",
);

assert.match(combatPageSource, /allowOutOfTurnAttack: true/);
assert.match(combatPageSource, /allowOutOfTurn: true/);
assert.match(combatPageSource, /worker-ai-engine-entry/);

console.log("combat roll entry/pre-stamina/roll/damage/hp gate chain is enforced");
