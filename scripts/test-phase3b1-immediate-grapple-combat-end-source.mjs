import assert from "node:assert/strict";
import fs from "node:fs";

const combatPage = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");
const grappleActions = fs.readFileSync("src/utils/combatActionHandlers/grappleActions.js", "utf8");

assert.match(grappleActions, /onPostHpMutation/);
assert.match(grappleActions, /source:\s*"grapple-hp-mutation"/);
assert.match(grappleActions, /combatEnded:\s*true/);
assert.match(combatPage, /onPostHpMutation:\s*\(updatedFighters, meta = \{\}\) => \{/);
assert.match(combatPage, /endCombatIfVictoryResolved\(fightersRef\.current \?\? updatedFighters\)/);
assert.match(combatPage, /eventType:\s*"grapple-combat-end-terminal-return"/);
assert.match(combatPage, /function cancelCombatOwnedContinuations\(\{/);
assert.match(combatPage, /grappleCallbacks/);
assert.match(combatPage, /totalCanceled/);

console.log("✅ Phase 3B1 immediate grapple combat-end source tests passed");
