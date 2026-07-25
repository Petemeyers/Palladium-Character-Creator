import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildCombatCommandLayoutSummary,
  COMBAT_COMMAND_LAYOUT,
} from "../src/utils/combatCommandLayout.js";
import { buildCombatActionCatalog } from "../src/utils/combatActionCatalog.js";

const hasFunction = (value) => {
  if (typeof value === "function") return true;
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(hasFunction);
};

const summary = buildCombatCommandLayoutSummary();

assert.equal(summary.commandCenterLabel, "Combat Command Center");
assert.equal(summary.actionCatalogLabel, "Combat Action Catalog");
assert.equal(summary.selectedActionLabel, "Selected Combat Action");
assert.equal(summary.compatibilityLabel, "Advanced Combat Tools");
assert.equal(summary.defaultCompatibilityCollapsed, true);
assert.equal(summary.compatibilityDescription, "Additional combat controls preserved for the current engine.");
assert.deepEqual(summary.order.slice(0, 3), [
  "Combat Command Center",
  "Combat Action Catalog",
  "Selected Combat Action",
]);
assert.equal(summary.order.at(-1), "Advanced Combat Tools");
assert.equal(hasFunction(summary), false, "layout metadata is display-safe");

summary.order.push("mutation probe");
assert.equal(COMBAT_COMMAND_LAYOUT.order.includes("mutation probe"), false, "layout summary does not mutate source order");

const actor = {
  id: "fighter-1",
  name: "Mimi",
  remainingActions: 1,
  currentStamina: 2,
  publicAttackPreviews: [{ name: "Shortsword", attackType: "melee", reach: "5 ft", damage: "1d6", hitBonus: 4 }],
};
const target = { id: "target-1", name: "Goblin", distanceFt: 5 };
const catalog = buildCombatActionCatalog({ actor, targets: [target], selectedTarget: target });
const attack = catalog.find((action) => action.type === "attack");

assert.ok(attack, "action catalog remains available");
assert.equal(attack.metadata.actorId, "fighter-1", "action catalog metadata remains intact");
assert.equal(hasFunction(catalog), false, "action catalog metadata remains display-safe");

const catalogPanel = readFileSync("src/components/CombatActionCatalogPanel.jsx", "utf8");
const selectedPanel = readFileSync("src/components/SelectedCombatActionPanel.jsx", "utf8");
const surrenderPanel = readFileSync("src/components/SurrenderDecisionPanel.jsx", "utf8");
const combatPage = readFileSync("src/pages/CombatPage.jsx", "utf8");
assert.match(catalogPanel, /overflowX="auto"/, "catalog remains accessible at narrow widths");
assert.match(catalogPanel, /isDisabled=\{!action\.enabled\}/, "illegal catalog commands are disabled");
assert.match(catalogPanel, /title=\{action\.disabledReason \|\| `Select \$\{action\.name\}`\}/, "commands expose semantic titles");
assert.match(selectedPanel, /MovementActionHandler|Movement targeting ready/, "movement remains discoverable through selected action resolution");
assert.match(combatPage, />\s*End Turn\s*</, "manual End Turn remains rendered");
assert.match(combatPage, /<SurrenderDecisionPanel/, "surrender decisions use their blocking lifecycle panel");
assert.match(surrenderPanel, /closeOnEsc=\{false\} closeOnOverlayClick=\{false\}/, "pending surrender blocks conflicting modal dismissal");

console.log("combat command layout tests passed");
