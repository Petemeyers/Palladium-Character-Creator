import assert from "node:assert/strict";
import {
  BATTLEFIELD_MAP_LIBRARY_KEY,
  LEGACY_MAP_MAKER_KEY,
  loadBattlefieldMapLibrary,
  saveBattlefieldMapToLibrary,
} from "../src/utils/maps/battlefieldMapLibrary.js";

class MemoryStorage {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
}

const storage = new MemoryStorage();
storage.setItem(LEGACY_MAP_MAKER_KEY, JSON.stringify([
  {
    id: "old-map",
    name: "Old Map",
    savedAt: "2026-08-01T00:00:00.000Z",
    mapDefinition: {
      id: "old-map",
      name: "Old Map",
      mapType: "hex",
      terrain: "OPEN_GROUND",
      lighting: "BRIGHT_DAYLIGHT",
      mapSize: { width: 2, height: 1 },
      grid: [[{ terrainType: "grass" }, { terrainType: "rock" }]],
    },
  },
]));

const migrated = loadBattlefieldMapLibrary({ storage });
assert.equal(migrated.length, 1);
assert.equal(migrated[0].mapDefinition.schemaVersion, 2);
assert.equal(migrated[0].mapDefinition.grid[0][1].formationType, "uneven-ground");

const result = saveBattlefieldMapToLibrary({
  id: "new-map",
  name: "New Map",
  mapType: "hex",
  terrain: "grass",
  size: { width: 1, height: 1 },
  grid: [[{ terrainType: "mud" }]],
}, { storage });
assert.equal(result.accepted, true);
assert.ok(storage.getItem(BATTLEFIELD_MAP_LIBRARY_KEY));
const reloaded = loadBattlefieldMapLibrary({ storage });
assert.ok(reloaded.some((entry) => entry.id === "new-map"));
assert.ok(reloaded.some((entry) => entry.id === "old-map"));
console.log("battlefield map library: ok");
