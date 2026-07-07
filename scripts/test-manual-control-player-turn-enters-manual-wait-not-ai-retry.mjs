import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveExplicitCombatControlMode } from "../src/utils/combatantSide.js";
import {
  decidePlayerTurnStartRoute,
  shouldEnterManualPlayerWait,
} from "../src/utils/aiToggleResume.js";

const actor = {
  id: "knight-2",
  team: "party",
  type: "player",
  controlMode: "ai",
  globalManualControlOverride: true,
};
const effectiveMode = resolveExplicitCombatControlMode(actor, {
  aiControlEnabled: false,
  schedulerSide: "player",
});
const route = decidePlayerTurnStartRoute({
  aiControlEnabled: false,
  isPartyActor: true,
  effectiveControlMode: effectiveMode,
  activeFighterMatches: true,
  canAct: true,
});

assert.equal(effectiveMode, "player");
assert.equal(route.route, "manual");
assert.equal(shouldEnterManualPlayerWait({
  aiControlEnabled: false,
  isPartyActor: true,
  currentTurnKey: "knight-2|1|4",
}), true);

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /globalManualControlOverride: !newValue/);

console.log("Manual-control player-turn handoff tests passed");
