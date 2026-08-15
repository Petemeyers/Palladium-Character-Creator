import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  assignBattleLocalIdentities,
  getCombatActorId,
} from "../src/utils/combatActorIdentity.js";

const source = readFileSync(
  new URL("../src/pages/CombatPage.jsx", import.meta.url),
  "utf8",
);

const toolbarStart = source.slice(
  source.indexOf('<Button\n                colorScheme="green"\n                variant="solid"'),
  source.indexOf('<Button\n                colorScheme="green"\n                variant="outline"'),
);
assert.ok(toolbarStart.length > 0, "main Start Battle control must remain present");
assert.match(
  toolbarStart,
  /onClick=\{\(\) => startCombat\(\)\}/,
  "main Start Battle must preserve the current deployment plan",
);
assert.doesNotMatch(
  toolbarStart,
  /skipDeployment:\s*true/,
  "main Start Battle must not discard explicit deployment positions",
);

const startCombatStart = source.indexOf("function startCombat(");
const startCombatEnd = source.indexOf("\n  // eslint-disable-next-line no-unused-vars", startCombatStart);
assert.ok(startCombatStart >= 0 && startCombatEnd > startCombatStart);
const startCombatSource = source.slice(startCombatStart, startCombatEnd);

assert.match(
  startCombatSource,
  /deploymentPositions\[fighter\.id\]\s*\|\|\s*deploymentPositions\[fighter\.originalCombatId\]/,
  "combat start must resolve deployment by canonical or original combat identity",
);
assert.match(
  startCombatSource,
  /if \(deployedPos\) \{\s*positionMap\[fighter\.id\] = deployedPos;/,
  "explicit deployment coordinates must become live positions unchanged",
);
assert.match(
  startCombatSource,
  /filter\(\(fighter\) => fighter\.type === side && !positionMap\[fighter\.id\]\)/,
  "only fighters missing an explicit deployment may receive generated placement",
);
assert.match(
  startCombatSource,
  /else \{\s*const initialPositions = getInitialPositions\(playerCount, enemyCount\);/,
  "legacy/default auto-placement must remain available when no deployment exists",
);
assert.match(
  startCombatSource,
  /positionsRef\.current = positionMap;\s*committedPositionsRef\.current = positionMap;\s*recordMovementCommitMap\(positionMap, "initial-combat-placement"\);\s*setPositions\(positionMap\);/,
  "one resolved position map must initialize every live position authority",
);

const deployedRoster = [
  { id: "charger-1", _id: "charger-1", name: "Charger", team: "party", type: "player" },
  { id: "bracer-1", _id: "bracer-1", name: "Bracer", team: "enemy", type: "enemy" },
];
const battleRoster = assignBattleLocalIdentities(deployedRoster);
assert.deepEqual(
  battleRoster.map(getCombatActorId),
  deployedRoster.map(getCombatActorId),
  "combat start identity assignment must preserve already-unique actor IDs",
);

const explicitPositions = {
  "charger-1": { x: 20, y: 24 },
  "bracer-1": { x: 20, y: 20 },
};
const handedOffPositions = Object.fromEntries(
  battleRoster.map((fighter) => [
    fighter.id,
    explicitPositions[fighter.id] || explicitPositions[fighter.originalCombatId],
  ]),
);
assert.deepEqual(handedOffPositions, explicitPositions);
assert.deepEqual(
  {
    dx: handedOffPositions["charger-1"].x - handedOffPositions["bracer-1"].x,
    dy: handedOffPositions["charger-1"].y - handedOffPositions["bracer-1"].y,
  },
  { dx: 0, dy: 4 },
  "opponent-relative deployment spacing must survive identity assignment",
);

console.log("combat start preserves explicit deployment and stable identity");
