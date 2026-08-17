import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const combatPath = path.join(root, "src/pages/CombatPage.jsx");
const fallbackPath = path.join(root, "src/utils/enemyMovementFallback.js");
const authorityPath = path.join(root, "src/utils/combat/structureAwareMovementAuthority.js");

for (const file of [combatPath, fallbackPath, authorityPath]) {
  assert.ok(fs.existsSync(file), `missing ${path.relative(root, file)}`);
}

const combat = fs.readFileSync(combatPath, "utf8");
const fallback = fs.readFileSync(fallbackPath, "utf8");
const authority = fs.readFileSync(authorityPath, "utf8");

assert.match(authority, /STRUCTURE_AWARE_MOVEMENT_ID/);
assert.match(authority, /admitStructureAwareCombatMovement/);
assert.match(authority, /filterStructureAwareCombatNeighbors/);
assert.match(authority, /findStructureAwareCombatPath/);

assert.match(combat, /structureAwareMovementAuthority\.js/);
assert.match(combat, /const getStructureAwareCombatNeighbors = useCallback/);
assert.match(combat, /eventType: "structure-traversal-rejected"/);
assert.match(combat, /admitStructureAwareCombatMovement\(\{/);
assert.match(combat, /getNeighbors: (?:approachMovementType === "FLY" \? getHexNeighbors : )?getStructureAwareCombatNeighbors/);
assert.match(combat, /eventType: "enemy-movement-commit-rejected"/);
assert.match(
  combat,
  /path:\s*(?:plan\?\.path\s*\|\|\s*null|Array\.isArray\(plan\?\.path\)\s*\?\s*plan\.path\s*:\s*null)/,
  "enemy movement must propagate the planner path into the canonical movement transaction",
);

const handleStart = combat.indexOf("const handlePositionChange = useCallback");
const preflightAt = combat.indexOf("structure-aware movement preflight", handleStart);
const canonicalAt = combat.indexOf("commitCanonicalMovement({", handleStart);
const entryAt = combat.indexOf("resolveWeaponEntryExchange({", handleStart);
assert.ok(handleStart >= 0 && preflightAt > handleStart, "missing central movement preflight");
assert.ok(canonicalAt < 0 || preflightAt < canonicalAt, "structure admission must precede canonical movement commit");
assert.ok(entryAt < 0 || preflightAt < entryAt, "structure admission must precede weapon entry exchange");

assert.match(fallback, /const moveResult = move\?\.\(plan\.position, plan\)/);
assert.match(fallback, /reason: "movement-commit-rejected"/);
assert.match(fallback, /movementAccepted: false/);

console.log("PASS Milestone 8C-8C.3B source contract");
