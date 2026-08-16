import assert from 'node:assert/strict';
import {
  BATTLEFIELD_TEST_BATTLE_APPLIED_KEY,
  BATTLEFIELD_TEST_BATTLE_REQUEST_KEY,
  clearBattlefieldTestBattleRequest,
  loadBattlefieldTestBattleRequest,
  markBattlefieldTestBattleApplied,
  saveBattlefieldTestBattleRequest,
} from '../src/utils/maps/battlefieldTestBattle.js';

const memory = new Map();
const storage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
};
const map = { id: 'test-live-map', name: 'Live Test', width: 2, height: 1, grid: [[{terrain:'mud'}, {terrain:'grass'}]] };
const request = saveBattlefieldTestBattleRequest(map, { storage });
assert.equal(loadBattlefieldTestBattleRequest({ storage }).map.id, 'test-live-map');
markBattlefieldTestBattleApplied(request, { storage });
assert.ok(storage.getItem(BATTLEFIELD_TEST_BATTLE_APPLIED_KEY));
clearBattlefieldTestBattleRequest({ storage });
assert.equal(storage.getItem(BATTLEFIELD_TEST_BATTLE_REQUEST_KEY), null);
console.log('PASS Test Battle request persists until explicit application acknowledgement');
