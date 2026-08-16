import assert from 'node:assert/strict';
import {
  BATTLEFIELD_MAP_LIBRARY_KEY,
  loadBattlefieldMapLibrary,
  saveBattlefieldMapToLibrary,
} from '../src/utils/maps/battlefieldMapLibrary.js';
import { BATTLEFIELD_MAP_SOURCES } from '../src/utils/maps/battlefieldMapAuthority.js';

const memory = new Map();
const storage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
};
const grid = [[{ terrain: 'grass' }]];
const builtIn = { id: 'builtin-forest-road', name: 'Forest Road', source: BATTLEFIELD_MAP_SOURCES.BUILT_IN, width: 1, height: 1, grid };
const saved = saveBattlefieldMapToLibrary({ ...builtIn, grid: [[{ terrain: 'mud' }]] }, { storage });
assert.equal(saved.accepted, true);
assert.equal(saved.entry.source, BATTLEFIELD_MAP_SOURCES.SAVED);
assert.notEqual(saved.entry.id, 'builtin-forest-road');
assert.ok(saved.entry.id.startsWith('saved-forest-road-'));

const loaded = loadBattlefieldMapLibrary({ storage, builtInMaps: [builtIn] });
const ids = loaded.map((entry) => entry.id);
assert.equal(new Set(ids).size, ids.length, 'library ids must be unique');
assert.ok(ids.includes('builtin-forest-road'));
assert.ok(ids.includes(saved.entry.id));
assert.equal(JSON.parse(storage.getItem(BATTLEFIELD_MAP_LIBRARY_KEY)).length, 1);
console.log('PASS built-in map save forks to unique user-map identity');
