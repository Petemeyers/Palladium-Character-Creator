import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { markCombatantFled, isCombatantFled } from "../src/utils/combatFledState.js";
import { hasCrossedRoutedEscapeBoundary } from "../src/utils/routingSystem.js";

const position = { x: 0, y: 23 };
assert.equal(hasCrossedRoutedEscapeBoundary(position, {
  minX: 0,
  minY: 0,
  maxX: 39,
  maxY: 29,
}), true);

const fled = markCombatantFled({
  id: "knight-1",
  team: "party",
  currentHP: 12,
  remainingActions: 1,
  state: { moraleState: "routed" },
}, "routed-off-field");
assert.equal(isCombatantFled(fled), true);
assert.equal(fled.inBattle, false);
assert.equal(fled.canAct, false);

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /hasCrossedRoutedEscapeBoundary\(myPos, ROUTED_ESCAPE_BOUNDS\)[\s\S]{0,180}markFighterFledOffMap\(fighter\.id, fighter\.name, "routed-off-field"\)/);

console.log("Routed-player edge escape tests passed");
