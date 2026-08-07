import assert from "node:assert/strict";
import { getCombatantFootprintHexes } from "../src/utils/enemyClosingMovement.js";

const center = { x: 18, y: 6 };

assert.equal(
  getCombatantFootprintHexes(
    { sizeCategory: "MEDIUM", sizeRank: 2 },
    center,
  ).length,
  1,
  "Medium combatants must occupy one hex",
);

assert.equal(
  getCombatantFootprintHexes(
    { sizeCategory: "SMALL", sizeRank: 1 },
    center,
  ).length,
  1,
  "Small combatants must occupy one hex",
);

assert.equal(
  getCombatantFootprintHexes(
    { sizeCategory: "LARGE", sizeRank: 3 },
    center,
  ).length,
  7,
  "Large combatants retain a radius-one footprint",
);

assert.equal(
  getCombatantFootprintHexes(
    {
      sizeCategory: "MEDIUM",
      sizeRank: 2,
      footprint: { radiusHex: 1 },
    },
    center,
  ).length,
  7,
  "Explicit footprint metadata must override the size default",
);

const occupiedLine = new Set(
  Array.from({ length: 10 }, (_, index) => `${18 + index},6`),
);
const candidate = { x: 18, y: 7 };
const mediumCandidateIsOpen = getCombatantFootprintHexes(
  { sizeCategory: "MEDIUM", sizeRank: 2 },
  candidate,
).every(({ x, y }) => !occupiedLine.has(`${x},${y}`));

assert.equal(
  mediumCandidateIsOpen,
  true,
  "A medium fighter must be able to step away from an adjacent deployment line",
);

console.log("enemy closing movement medium-footprint regression: passed");
