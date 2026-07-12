import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { getCombatantGridPosition } from "../src/utils/combat/noMovePositionPreservation.js";

const combatPageSource = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

const staleEnemy = { id: "enemy-knight", name: "Knight [enemy]", position: { x: 27, y: 15 } };
const committedPositions = { "enemy-knight": { x: 28, y: 13 } };
const positionsRef = { "enemy-knight": { x: 27, y: 15 } };
const latestEnemyForSnapshot = { id: "enemy-knight", name: "Knight [enemy]", position: { x: 27, y: 15 } };
const currentPos = { x: 27, y: 15 };

const latestNoMovePosition = getCombatantGridPosition(
  committedPositions[staleEnemy.id] || positionsRef[staleEnemy.id] || latestEnemyForSnapshot || currentPos,
) || currentPos;
const scheduledEnemyPosition = getCombatantGridPosition(staleEnemy);

assert.deepEqual(latestNoMovePosition, { x: 28, y: 13 });
assert.deepEqual(scheduledEnemyPosition, { x: 27, y: 15 });
assert.notDeepEqual(latestNoMovePosition, scheduledEnemyPosition);

assert.match(combatPageSource, /enemy no-move snapshot corrected from stale actor: actor=/);
assert.match(combatPageSource, /stale=\(\$\{scheduledEnemyPosition\.x\},\$\{scheduledEnemyPosition\.y\}\) latest=\(\$\{latestNoMovePosition\.x\},\$\{latestNoMovePosition\.y\}\)/);
assert.match(combatPageSource, /const latestNoMovePosition = resolveLatestNoMovePosition\(\s*enemy\.id,\s*enemy,\s*latestEnemyForSnapshot,\s*approachFinalizerSource,\s*\) \|\| currentPos;/);
assert.match(combatPageSource, /noMoveFallbackPositionSnapshot = \{ \.\.\.latestNoMovePosition \}/);
assert.match(combatPageSource, /enemy no-move fallback position snapshot: actor=.*before=\(\$\{noMoveFallbackPositionSnapshot\.x\},\$\{noMoveFallbackPositionSnapshot\.y\}\)/s);
assert.match(combatPageSource, /return approachFinalizerSource === "enemy-ai-no-move-fallback"\s*\?\s*finalizeNoMovePreservingPosition\(/s);

console.log("enemy no-move snapshot latest-position tests passed");
