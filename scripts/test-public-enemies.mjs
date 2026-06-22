import assert from "node:assert/strict";
import PUBLIC_ENEMIES from "../src/data/publicEnemies.js";
import PUBLIC_SPECIES from "../src/data/publicSpecies.js";
import { adaptPublicEnemyToRosterEntry } from "../src/utils/publicEnemyRosterAdapter.js";

const requiredFields = [
  "id",
  "name",
  "creatureType",
  "size",
  "armorClass",
  "hitPoints",
  "speed",
  "abilityScores",
  "actions",
  "source",
  "ruleset",
];

const ids = PUBLIC_ENEMIES.map((enemy) => enemy.id);
assert.equal(new Set(ids).size, ids.length, "Public enemy ids must be unique");

PUBLIC_ENEMIES.forEach((enemy) => {
  requiredFields.forEach((field) => {
    assert.ok(enemy[field] !== undefined && enemy[field] !== null, `${enemy.id} should include ${field}`);
  });
  ["str", "dex", "con", "int", "wis", "cha"].forEach((ability) => {
    assert.equal(typeof enemy.abilityScores[ability], "number", `${enemy.id} should include ${ability}`);
  });
  assert.ok(Array.isArray(enemy.actions) && enemy.actions.length > 0, `${enemy.id} should include actions`);
});

const speciesNames = new Set(PUBLIC_SPECIES.map((species) => species.name.toLowerCase()));
["Wolf", "Brown Bear", "Giant Rat"].forEach((animalName) => {
  assert.equal(speciesNames.has(animalName.toLowerCase()), false, `${animalName} should not be a player species`);
});

const restrictedTerms = [
  "Palladium",
  "O.C.C.",
  "R.C.C.",
  "P.P.E.",
  "I.S.P.",
  "S.D.C.",
  "M.D.C.",
  "Horror Factor",
];
const serializedEnemies = JSON.stringify(PUBLIC_ENEMIES);
restrictedTerms.forEach((term) => {
  assert.equal(serializedEnemies.includes(term), false, `Public enemy data should not include ${term}`);
});

["goblin-warrior", "bandit", "wolf"].forEach((id) => {
  const enemy = PUBLIC_ENEMIES.find((entry) => entry.id === id);
  const snapshot = JSON.parse(JSON.stringify(enemy));
  const rosterEntry = adaptPublicEnemyToRosterEntry(enemy);
  assert.equal(rosterEntry.side, "enemy", `${id} should convert to enemy roster side`);
  assert.equal(rosterEntry.source, "public-enemy", `${id} should mark public enemy source`);
  assert.equal(rosterEntry.name, enemy.name, `${id} should preserve name`);
  assert.deepEqual(enemy, snapshot, `${id} adapter should not mutate source data`);
});

console.log("Public enemy data tests passed.");
