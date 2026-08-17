import assert from "node:assert/strict";
import fs from "node:fs";
import {
  generateSeededBattlefield,
  validateSeededBattlefield,
} from "../src/utils/maps/seededBattlefieldGenerator.js";

const first = generateSeededBattlefield({
  seed: "black-creek-88421753",
  preset: "mixed-wilderness",
  width: 40,
  height: 30,
  randomizeEnvironment: true,
  fogOfWarEnabled: true,
});
const second = generateSeededBattlefield({
  seed: "black-creek-88421753",
  preset: "mixed-wilderness",
  width: 40,
  height: 30,
  randomizeEnvironment: true,
  fogOfWarEnabled: true,
});
const different = generateSeededBattlefield({
  seed: "black-creek-88421754",
  preset: "mixed-wilderness",
  width: 40,
  height: 30,
  randomizeEnvironment: true,
  fogOfWarEnabled: true,
});

assert.deepEqual(first, second, "same seed/settings must reproduce exactly");
assert.notDeepEqual(first.grid, different.grid, "different seeds should produce different battlefield terrain");
assert.equal(first.generator.seed, "black-creek-88421753");
assert.equal(first.generator.version, 1);
assert.equal(first.environment.fogOfWar.enabled, true);
assert.equal(validateSeededBattlefield(first).valid, true);

for (const preset of [
  "river-crossing",
  "mountain-pass",
  "ruined-village",
  "marsh",
  "rocky-highlands",
  "open-field",
]) {
  const generated = generateSeededBattlefield({ seed: "preset-acceptance", preset, width: 40, height: 30 });
  assert.equal(validateSeededBattlefield(generated).valid, true, `${preset} must produce a connected battlefield`);
}

const mirrored = generateSeededBattlefield({
  seed: "weapon-balance-test",
  preset: "rocky-highlands",
  width: 20,
  height: 12,
  balanceMode: "mirrored",
});
for (let y = 0; y < mirrored.height; y += 1) {
  for (let x = 0; x < Math.floor(mirrored.width / 2); x += 1) {
    const a = mirrored.grid[y][x];
    const b = mirrored.grid[y][mirrored.width - 1 - x];
    assert.equal(a.terrainType, b.terrainType);
    assert.equal(a.formationType, b.formationType);
    assert.equal(a.elevation, b.elevation);
  }
}

const source = fs.readFileSync(new URL("../src/utils/maps/seededBattlefieldGenerator.js", import.meta.url), "utf8");
assert.doesNotMatch(source, /Math\.random\s*\(/, "seeded generator must not use Math.random");
console.log("seeded battlefield generator: ok");
