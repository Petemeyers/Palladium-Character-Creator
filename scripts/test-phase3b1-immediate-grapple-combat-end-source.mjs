import assert from "node:assert/strict";
import fs from "node:fs";

const combatPage = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");
const grappleActions = fs.readFileSync("src/utils/combatActionHandlers/grappleActions.js", "utf8");

assert.match(grappleActions, /onPostHpMutation/);
assert.match(grappleActions, /source:\s*"grapple-hp-mutation"/);
assert.match(grappleActions, /combatEnded:\s*true/);
assert.match(combatPage, /onPostHpMutation:\s*\(updatedFighters, meta = \{\}\) => \{/);
assert.match(combatPage, /const victoryState = getCombatVictoryState\(fightersRef\.current \?\? updatedFighters\)/);
const hpCallbackStart = combatPage.indexOf("onPostHpMutation: (updatedFighters");
const hpCallbackEnd = combatPage.indexOf("registerDroppedBattlefieldItem", hpCallbackStart);
assert.doesNotMatch(combatPage.slice(hpCallbackStart, hpCallbackEnd), /endCombatIfVictoryResolved/,
  "HP mutation detects terminal state without clearing canonical lifecycle registries");
assert.match(combatPage, /auditSettledActionContinuation\([\s\S]*?endCombatIfVictoryResolved\(fightersRef\.current \?\? fighters\)/);
assert.match(combatPage, /eventType:\s*"grapple-combat-end-terminal-return"/);
assert.match(combatPage, /function cancelCombatOwnedContinuations\(\{/);
assert.match(combatPage, /grappleCallbacks/);
assert.match(combatPage, /totalCanceled/);

console.log("✅ Phase 3B1 immediate grapple combat-end source tests passed");
