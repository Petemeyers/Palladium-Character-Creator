import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  preserveLatestPositionAcrossStores,
} from "../src/utils/combat/noMovePositionPreservation.js";

const combatPageSource = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const playerTurnAISource = readFileSync(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");
const helperSource = readFileSync(new URL("../src/utils/combat/noMovePositionPreservation.js", import.meta.url), "utf8");

{
  const result = preserveLatestPositionAcrossStores({
    fighterId: "party-knight",
    staleActor: { id: "party-knight", name: "Knight [party]", position: { x: 27, y: 15 } },
    updatedFighters: [
      { id: "party-knight", name: "Knight [party]", position: { x: 27, y: 15 }, hex: { x: 27, y: 15 } },
      { id: "enemy-knight", name: "Knight [enemy]", position: { x: 27, y: 15 } },
    ],
    positions: {
      "party-knight": { x: 27, y: 15 },
      "enemy-knight": { x: 27, y: 15 },
    },
    lastKnownPositions: {
      "party-knight": { x: 29, y: 15 },
      "enemy-knight": { x: 27, y: 15 },
    },
    patch: {
      position: { x: 27, y: 15 },
      x: 27,
      y: 15,
      moraleState: { survivalIntent: "cower" },
      remainingActions: 0,
    },
  });

  assert.deepEqual(result.positions["party-knight"], { x: 29, y: 15 });
  assert.deepEqual(result.fighters[0].position, { x: 29, y: 15 });
  assert.deepEqual(result.fighters[0].hex, { x: 29, y: 15 });
  assert.notDeepEqual(
    result.positions["party-knight"],
    result.positions["enemy-knight"],
    "exhausted cower must not create stale same-hex overlap",
  );
  assert.equal(result.fighters[0].remainingActions, 0);
  assert.equal(result.fighters[0].moraleState.survivalIntent, "cower");
}

assert.match(combatPageSource, /is too exhausted to keep fleeing and cowers in place/);
assert.match(combatPageSource, /const coweringActor = offerRoutedExhaustedCowerSurrender\(surrenderingActor/);
assert.match(combatPageSource, /const canonicalOffer = recipient \? commitCanonicalSurrenderOfferToRoster\(/);
assert.match(combatPageSource, /finalizeNoMovePreservingPosition\(\{\s*[\s\S]*?staleActor: offeredActor,\s*[\s\S]*?actorPatch: offeredActor,\s*[\s\S]*?source: "routed-exhausted-cower"/);
assert.match(combatPageSource, /const preserveNoMovePosition = useCallback/);
assert.match(combatPageSource, /const finalizeNoMovePreservingPosition = useCallback/);
assert.match(combatPageSource, /resolveLatestNoMovePosition\(latestFighter\.id, staleActor, latestFighter, source\)/);
assert.match(combatPageSource, /const lastMovementCommitRef = useRef\(\{\}\)/);
assert.match(combatPageSource, /lastMovementCommit: lastMovementCommitRef\.current\?\.\[fighterId\]/);
assert.match(combatPageSource, /positionsRef\.current = repairedPositions/);
assert.match(helperSource, /no-move fallback preserved canonical position over stale snapshot/);

assert.match(playerTurnAISource, /handlePositionChange\(player\.id, retreatDestination\.position, \{/);
assert.match(playerTurnAISource, /action: "RETREAT"/);
assert.match(
  combatPageSource,
  /const synced = syncCombinedPositions\(fighters, updated\);\s+positionsRef\.current = synced;\s+committedPositionsRef\.current = synced;\s+recordLastMovementCommit\(\s*combatantId,\s*newPosition,\s*movementInfo\?\.source \|\| movementInfo\?\.action \|\| "move",\s*\);\s+return synced;/,
  "normal handlePositionChange movement, including RETREAT, must update committedPositionsRef",
);

console.log("exhausted cower preserves position tests passed");
