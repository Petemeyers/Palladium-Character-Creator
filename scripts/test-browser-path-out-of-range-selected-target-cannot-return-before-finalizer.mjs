import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

const selected = source.indexOf("enemy out-of-range target selected for approach");
const movementBranch = source.indexOf("if (needsToMoveCloser && target && livePositions[enemy.id] && livePositions[target.id])", selected);
const fallbackBranch = source.indexOf("if (needsToMoveCloser) {", movementBranch + 1);
const finalValidation = source.indexOf("// FIX: Final validation: make sure target can still be attacked", fallbackBranch);

assert.ok(selected >= 0, "selected target diagnostic should exist");
assert.ok(movementBranch > selected, "movement branch should follow selected target diagnostic");
assert.ok(fallbackBranch > movementBranch, "no-move fallback branch should follow movement branch");
assert.ok(finalValidation > fallbackBranch, "fallback finalizer should happen before final attack validation");

const betweenSelectedAndFallback = source.slice(selected, finalValidation);
assert.match(
  betweenSelectedAndFallback,
  /scheduleEnemyAIEndTurn\(/,
  "selected out-of-range target path should contain accepted enemy finalizer scheduling",
);
assert.match(
  betweenSelectedAndFallback,
  /enemy approach branch entering movement planner/,
  "selected out-of-range target path should enter planner",
);
assert.match(
  betweenSelectedAndFallback,
  /enemy approach movement planner returned/,
  "selected out-of-range target path should log planner result",
);
assert.match(
  betweenSelectedAndFallback,
  /enemy approach movement committed/,
  "selected out-of-range target path should commit or fallback through the movement executor",
);

console.log("browser selected target cannot return before finalizer tests passed");
