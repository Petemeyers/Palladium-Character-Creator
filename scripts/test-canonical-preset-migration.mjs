import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CANONICAL_PRESET_SCHEMA_VERSION,
  PRESET_MIGRATION_MARKER_KEY,
  SAVED_PRESET_STORAGE_KEY,
  deleteAllSavedPresets,
  deleteSavedPreset,
  getSavedPresets,
  migrateLegacyPresetStorage,
  savePreset,
} from "../src/utils/savedPresets.js";
import { getCanonicalCombatActorDefinition } from "../src/data/canonicalCombatActors.js";

const memoryStorage = (seed = {}) => {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    dump: () => Object.fromEntries(data),
  };
};

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.doesNotMatch(source, /Quick Start|quickStartFight|presceneBattles|loadPrescene/);
assert.equal(fs.existsSync(new URL("../src/data/presceneBattles.js", import.meta.url)), false);

const activeSetup = JSON.stringify({ fighters: ["live"], positions: { live: { x: 1, y: 1 } } });
const storage = memoryStorage({
  [SAVED_PRESET_STORAGE_KEY]: JSON.stringify([{ id: "legacy-one" }, { id: "legacy-two" }]),
  savedPresets: JSON.stringify([{ id: "legacy-three" }]),
  activeCombatSetup: activeSetup,
});
const events = [];
const migration = migrateLegacyPresetStorage({ storage, emitDeveloperEvent: (event) => events.push(event) });
assert.equal(migration.removedCount, 3);
assert.equal(events[0].eventType, "obsolete-combat-presets-removed");
assert.equal(storage.getItem("activeCombatSetup"), activeSetup, "unsaved active setup survives preset purge");
assert.equal(storage.getItem(PRESET_MIGRATION_MARKER_KEY), "complete");
assert.equal(migrateLegacyPresetStorage({ storage }).migrated, false, "migration runs once");

const fighter = { ...structuredClone(getCanonicalCombatActorDefinition("knight")), id: "knight-live", team: "party" };
const firstId = savePreset({ name: "Canonical one", fighters: [fighter], positions: { "knight-live": { x: 2, y: 3 } } }, { storage });
const secondId = savePreset({ name: "Canonical two", fighters: [fighter], positions: {} }, { storage });
assert.ok(getSavedPresets({ storage }).every((preset) => preset.presetSchemaVersion === CANONICAL_PRESET_SCHEMA_VERSION));
assert.equal(deleteSavedPreset(firstId, { storage }).deletedCount, 1);
assert.equal(getSavedPresets({ storage }).some((preset) => preset.id === firstId), false);
assert.equal(getSavedPresets({ storage }).some((preset) => preset.id === secondId), true);
assert.equal(deleteAllSavedPresets({ storage }).deletedCount, 1);
assert.deepEqual(getSavedPresets({ storage }), []);
assert.deepEqual(getSavedPresets({ storage }), [], "reload does not restore deleted presets");

assert.throws(
  () => savePreset({ name: "Noncanonical", fighters: [{ id: "mystery", name: "Mystery" }], positions: {} }, { storage }),
  /cannot normalize/,
);
console.log("canonical preset migration and management passed: 15");
