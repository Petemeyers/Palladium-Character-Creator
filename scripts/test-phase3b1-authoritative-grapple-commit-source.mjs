import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const combatPage = readFileSync("src/pages/CombatPage.jsx", "utf8");

assert.match(combatPage, /const setGrappleFighters = \(updater\) => \{/);
assert.match(combatPage, /const authoritative = fightersRef\.current \?\? fighters \?\? \[\]/);
assert.match(combatPage, /eventType:\s*"authoritative-combatant-commit"/);
assert.match(combatPage, /eventType:\s*"authoritative-state-regression-blocked"/);
assert.match(combatPage, /field=combatStamina\|remainingActions\|round\|initiativeIndex|field=\$\{field\}/);
assert.match(combatPage, /eventType:\s*symmetric\s*\?\s*"grapple-completion-state-validated"\s*:\s*"grapple-completion-state-mismatch"/);
assert.match(combatPage, /eventType:\s*"combat-action-sequence-exceeded"/);
assert.match(combatPage, /eventType:\s*"combat-action-entry-without-turn-owner"/);
assert.match(combatPage, /initiativeActionSequenceRef\.current >= allowedActionsPerTurn/);

console.log("✅ Phase 3B1 authoritative grapple commit source tests passed");
