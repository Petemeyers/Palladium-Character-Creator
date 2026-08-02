import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const combatPageSource = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const playerTurnAISource = readFileSync(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");

function commitPlayerAIPositionHarness({ fighters, positions, committedPositions, fighterLike, destination }) {
  const nextPosition = {
    ...destination,
    x: Number(destination.x),
    y: Number(destination.y),
  };
  const updatedPositions = {
    ...(positions || {}),
    [fighterLike.id]: nextPosition,
  };
  const updatedCommittedPositions = {
    ...(committedPositions || {}),
    [fighterLike.id]: { ...nextPosition },
  };
  const updatedFighters = fighters.map((fighter) => (
    fighter.id === fighterLike.id
      ? {
          ...fighter,
          x: nextPosition.x,
          y: nextPosition.y,
          position: { ...nextPosition },
          hex: fighter.hex ? { ...nextPosition } : fighter.hex,
        }
      : fighter
  ));
  return { fighters: updatedFighters, positions: updatedPositions, committedPositions: updatedCommittedPositions };
}

{
  const result = commitPlayerAIPositionHarness({
    fighters: [{ id: "party-knight", name: "Knight [party]", x: 8, y: 15, position: { x: 8, y: 15 }, hex: { x: 8, y: 15 } }],
    positions: { "party-knight": { x: 8, y: 15 }, "enemy-knight": { x: 18, y: 17 } },
    committedPositions: { "party-knight": { x: 8, y: 15 }, "enemy-knight": { x: 18, y: 17 } },
    fighterLike: { id: "party-knight", name: "Knight [party]" },
    destination: { x: 19, y: 17 },
  });

  assert.deepEqual(result.fighters[0].position, { x: 19, y: 17 });
  assert.deepEqual(result.positions["party-knight"], { x: 19, y: 17 });
  assert.deepEqual(result.committedPositions["party-knight"], { x: 19, y: 17 });
}

{
  const result = commitPlayerAIPositionHarness({
    fighters: [{ id: "party-knight", name: "Knight [party]", x: 19, y: 17, position: { x: 19, y: 17 }, hex: { x: 19, y: 17 } }],
    positions: { "party-knight": { x: 19, y: 17 }, "enemy-knight": { x: 18, y: 17 } },
    committedPositions: { "party-knight": { x: 19, y: 17 }, "enemy-knight": { x: 18, y: 17 } },
    fighterLike: { id: "party-knight", name: "Knight [party]" },
    destination: { x: 10, y: 15 },
  });

  assert.deepEqual(result.fighters[0].position, { x: 10, y: 15 }, "second flanking move should persist fighter position");
  assert.deepEqual(result.positions["party-knight"], { x: 10, y: 15 }, "second flanking move should persist position store");
  assert.deepEqual(result.committedPositions["party-knight"], { x: 10, y: 15 }, "second flanking move should persist committed store");
}

assert.match(playerTurnAISource, /commitPlayerAIPosition/);
assert.match(playerTurnAISource, /commitPlayerAIPosition\(player, bestFlankPos, "player-ai-flanking"\)/);
assert.match(playerTurnAISource, /flanking post-move continuation: inRange=/);

assert.match(combatPageSource, /const commitPlayerAIPosition = \(fighterLike, destination, source = "player-ai-movement"\) =>/);
assert.match(combatPageSource, /handlePositionChange\(fighterLike\.id, nextPosition, \{/);
assert.match(combatPageSource, /persistImmediately: true/);
assert.match(combatPageSource, /source,/);
assert.match(combatPageSource, /position: \{ \.\.\.nextPosition \}/);
assert.match(
  combatPageSource,
  /const movementLabel = source === "player-ai-approach-move-only"\s+\? "player AI approach movement committed"\s+: "player AI flanking movement committed"/,
);
assert.match(combatPageSource, /\$\{movementLabel\}: actor=/);
assert.match(combatPageSource, /commitPlayerAIPosition,/);
assert.doesNotMatch(combatPageSource, /Called shot available/);
assert.match(combatPageSource, /stale attack roll blocked: actor=/);
assert.match(combatPageSource, /executionKey=\$\{attackActionId\}/);

console.log("player AI flanking movement commit tests passed");
