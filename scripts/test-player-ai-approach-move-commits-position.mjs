import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const combatPageSource = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const playerTurnAISource = readFileSync(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");

assert.match(
  playerTurnAISource,
  /commitPlayerAIPosition\(player, chosenMove\.pos, "player-ai-approach-move-only"\)/,
  "player AI approach move-only should use the canonical position commit helper",
);
assert.match(
  playerTurnAISource,
  /x: chosenMove\.pos\.x,\s+y: chosenMove\.pos\.y,\s+position: \{ x: chosenMove\.pos\.x, y: chosenMove\.pos\.y \},\s+hex: f\.hex \? \{ x: chosenMove\.pos\.x, y: chosenMove\.pos\.y \} : f\.hex/s,
  "approach action consumption should not overwrite the newly committed fighter position",
);
assert.match(combatPageSource, /const commitPlayerAIPosition = \(fighterLike, destination, source = "player-ai-movement"\) => \{/);
assert.match(combatPageSource, /positionsRef\.current = updatedPositions/);
assert.match(combatPageSource, /committedPositionsRef\.current = \{\s+\.\.\.\(committedPositionsRef\.current \|\| \{\}\),\s+\[fighterLike\.id\]: \{ \.\.\.nextPosition \},\s+\}/);
assert.match(combatPageSource, /recordLastMovementCommit\(fighterLike\.id, nextPosition, source\)/);
assert.match(combatPageSource, /position: \{ \.\.\.nextPosition \}/);
assert.match(combatPageSource, /hex: fighter\.hex \? \{ \.\.\.nextPosition \} : fighter\.hex/);
assert.match(
  combatPageSource,
  /const movementLabel = source === "player-ai-approach-move-only"\s+\? "player AI approach movement committed"\s+: "player AI flanking movement committed"/,
);
assert.match(
  combatPageSource,
  /\`\$\{movementLabel\}: actor=\$\{formatCombatActorLabel\(fighterLike,[\s\S]*?source=\$\{source\}/,
);

console.log("player AI approach move commit tests passed");
