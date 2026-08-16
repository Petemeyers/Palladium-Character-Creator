import assert from "node:assert/strict";
import { BATTLEFIELD_TEST_BATTLE_REQUEST_KEY, consumeBattlefieldTestBattleRequest, loadBattlefieldTestBattleRequest, saveBattlefieldTestBattleRequest } from "../src/utils/maps/battlefieldTestBattle.js";

class MemoryStorage {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}
const storage = new MemoryStorage();
const request = saveBattlefieldTestBattleRequest({ id: "test-map", name: "Test Map", width: 1, height: 1, grid: [[{ terrain: "grass" }]] }, { storage, requestedAt: "2026-08-07T00:00:00.000Z" });
assert.equal(request.map.id, "test-map");
assert(storage.getItem(BATTLEFIELD_TEST_BATTLE_REQUEST_KEY));
assert.equal(loadBattlefieldTestBattleRequest({ storage }).map.name, "Test Map");
assert.equal(consumeBattlefieldTestBattleRequest({ storage }).map.id, "test-map");
assert.equal(loadBattlefieldTestBattleRequest({ storage }), null);
console.log("battlefield test battle request: ok");
