import assert from "node:assert/strict";

import {
  cleanMapLabelText,
  getMapCombatantTokenLabel,
  getMapCombatantTooltip,
  shouldShowMapCombatantLabel,
} from "../src/utils/mapCombatantLabels.js";

const hasUnsafeText = (value) =>
  /[^\x20-\x7E]/.test(String(value)) ||
  new RegExp("[\\u00c3\\u00f0\\ufffd\\u00e2\\u0192\\u00c2\\u00c5\\u00c6\\u0153\\u00a2\\u20ac\\u2122\\u0178\\u00a1\\u00af\\u00b8]").test(String(value));

const corruptedPrefix = String.fromCharCode(0x00c3, 0x0192, 0x00c6, 0x2019, 0x00c3, 0x201a, 0x00c2, 0x00b0);

const fighter = {
  id: "fighter-1",
  name: "Shield Bearer",
  isEnemy: false,
  currentHP: 12,
  currentStamina: 5,
};

assert.equal(shouldShowMapCombatantLabel({ combatant: fighter }), false, "normal units do not get always-visible labels");
assert.equal(getMapCombatantTokenLabel({ combatant: fighter }), "", "normal unit label is empty");
assert.equal(getMapCombatantTokenLabel({ combatant: fighter, isHovered: true }), "", "hover uses tooltip only");

const currentLabel = getMapCombatantTokenLabel({ combatant: fighter, isCurrent: true });
assert.equal(currentLabel, "Shield Bearer Current", "current unit gets compact current label");
assert.equal(hasUnsafeText(currentLabel), false, "current label is display safe");

const selectedLabel = getMapCombatantTokenLabel({ combatant: fighter, isSelected: true });
assert.equal(selectedLabel, "Shield Bearer HP 12", "selected unit label includes HP");
assert.equal(hasUnsafeText(selectedLabel), false, "selected label is display safe");

const enemyTooltip = getMapCombatantTooltip({
  name: "Goblin Warrior",
  side: "enemy",
  hp: 7,
  stamina: 3,
});
assert.equal(enemyTooltip, "Goblin Warrior | Side: Enemy | HP: 7 | Stamina: 3");
assert.equal(hasUnsafeText(enemyTooltip), false, "tooltip is display safe");

const corrupted = cleanMapLabelText(`${corruptedPrefix}Broken Wolf`, "Unit");
assert.equal(corrupted, "Broken Wolf", "corrupted glyph bytes are removed");
assert.equal(hasUnsafeText(corrupted), false, "cleaned text has no corrupted glyphs");

assert.doesNotThrow(() => getMapCombatantTokenLabel({ combatant: null, isCurrent: true }));
assert.doesNotThrow(() => getMapCombatantTooltip({ name: { raw: true }, hp: { value: 1 } }));
assert.equal(getMapCombatantTooltip({ name: { raw: true }, hp: { value: 1 } }).includes("[object Object]"), false);

const longLabel = getMapCombatantTokenLabel({
  combatant: { name: "Extremely Long Battlefield Combatant Name", currentHP: 99 },
  isSelected: true,
});
assert.ok(longLabel.length <= 28, "map labels stay compact");
assert.equal(hasUnsafeText(longLabel), false, "shortened labels remain display safe");

console.log("map combatant label tests passed");
