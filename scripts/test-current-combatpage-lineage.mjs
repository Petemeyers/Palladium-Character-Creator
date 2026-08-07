import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../src/pages/CombatPage.jsx", import.meta.url),
  "utf8",
);

assert.match(
  source,
  /import arenaRoster from "\.\.\/data\/arenaRoster\.js";/,
  "CombatPage must remain on the current arenaRoster architecture",
);
assert.match(
  source,
  /import SELECTABLE_ACTORS from "\.\.\/data\/selectableActors\.js";/,
  "CombatPage must retain selectable actor support",
);
assert.doesNotMatch(
  source,
  /\.\.\/data\/bestiary\.json/,
  "obsolete missing bestiary.json import must not return",
);
assert.match(
  source,
  /applyEquipmentSelection/,
  "explicit equipment authority must remain integrated",
);

console.log("current CombatPage lineage test passed");
