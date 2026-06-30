import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCombatActionCatalog } from "../src/utils/combatActionCatalog.js";
import { buildCombatCommandLayoutSummary } from "../src/utils/combatCommandLayout.js";
import { endManualTurnActions } from "../src/utils/combatCommandStateCleanup.js";

const layout = buildCombatCommandLayoutSummary();
assert.equal(layout.order[0], "Combat Command Center");
assert.equal(layout.order.at(-1), "Legacy / Compatibility Tools");
assert.equal(layout.defaultCompatibilityCollapsed, true);

const compatibilitySource = readFileSync("src/components/CompatibilityCombatControlsPanel.jsx", "utf8");
assert.match(compatibilitySource, /defaultIndex=\{\[\]\}/, "legacy controls are collapsed by default");
const combatPageSource = readFileSync("src/pages/CombatPage.jsx", "utf8");
assert.ok(
  combatPageSource.indexOf("<CombatActionCatalogPanel") < combatPageSource.indexOf("<CompatibilityCombatControlsPanel", combatPageSource.indexOf("<CombatActionCatalogPanel")),
  "primary catalog renders before the following compatibility panel"
);

const actor = {
  id: "longbowman-1",
  name: "Longbowman",
  team: "party",
  type: "player",
  remainingActions: 2,
  currentStamina: 4,
  originalActorMetadata: { attributes: { deftness: 15, awareness: 13 } },
  position: { x: 0, y: 0 },
  attacks: [
    { name: "Longbow Shot", type: "ranged", range: 150, damage: "1d8", attackBonus: 4 },
    { name: "Knife Attack", type: "melee", range: 60, reach: 5, damage: "1d4", attackBonus: 2 },
  ],
};
const target = { id: "target-1", name: "Goblin Warrior", team: "enemy", type: "enemy", distanceFt: 40 };
const catalog = buildCombatActionCatalog({ actor, targets: [target], selectedTarget: target });
const bow = catalog.find((action) => action.metadata.attackName === "Longbow Shot");
const knife = catalog.find((action) => action.metadata.attackName === "Knife Attack");
assert.match(bow.previewSummary, /40 \/ 150 ft/);
assert.equal(bow.metadata.distanceFt, 40);
assert.equal(bow.metadata.rangeType, "ranged");
assert.equal(knife.enabled, false);
assert.equal(knife.metadata.rangeType, "melee");
assert.match(knife.disabledReason, /out of reach/i);

const ended = endManualTurnActions(
  [{ id: "actor-1", remainingActions: 2 }, { id: "actor-2", remainingActions: 1 }],
  { id: "actor-1" }
);
assert.equal(ended[0].remainingActions, 0);
assert.equal(ended[1].remainingActions, 1, "End All Actions affects only the current actor");

const manualResolverSource = readFileSync("src/components/ManualPublicAttackTest.jsx", "utf8");
assert.match(manualResolverSource, /Target: \{targetRow\.summary\.name\}/);
assert.match(manualResolverSource, /getRangedAttackRangeModifier/);
assert.match(combatPageSource, /getRangedAttackRangeModifier/);
assert.match(manualResolverSource, /Attack \$\{targetRow\.summary\.name\} with/);

console.log("combat control streamlining tests passed");
