import assert from "node:assert/strict";
import { BATTLEFIELD_MAP_LIBRARY_KEY, LEGACY_MAP_MAKER_KEY, loadBattlefieldMapLibrary } from "../src/utils/maps/battlefieldMapLibrary.js";
import { getBattlefieldPropOffset } from "../src/utils/maps/battlefieldVisibilityAuthority.js";

function storageWith(entries = {}) {
  const data = new Map(Object.entries(entries));
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

const legacyStorage = storageWith({
  [LEGACY_MAP_MAKER_KEY]: JSON.stringify([{ id: "legacy", name: "Legacy Editor Map", mapDefinition: { source: "saved", width: 20, height: 15, mapType: "hex", grid: Array.from({length:15},()=>Array.from({length:20},()=>({terrain:"grass"}))), props: [{ id: "tree", type: "tree", q: 2, r: 3, blocksLineOfSight: true }] } }]),
});
const legacy = loadBattlefieldMapLibrary({ storage: legacyStorage }).find((entry) => entry.id === "legacy");
assert.equal(legacy.mapDefinition.props[0].coordinateSpace, "axial");
assert.notDeepEqual(getBattlefieldPropOffset(legacy.mapDefinition.props[0], legacy.mapDefinition), { x: 2, y: 3 });

const generatedStorage = storageWith({
  [BATTLEFIELD_MAP_LIBRARY_KEY]: JSON.stringify([{ id: "generated", name: "Old Generated Map", mapDefinition: { source: "generated", generator: { seed: "old", version: 1 }, width: 20, height: 15, mapType: "hex", grid: Array.from({length:15},()=>Array.from({length:20},()=>({terrain:"grass"}))), props: [{ id: "rock", type: "boulder", q: 2, r: 3, blocksLineOfSight: true }] } }]),
});
const generated = loadBattlefieldMapLibrary({ storage: generatedStorage }).find((entry) => entry.id === "generated");
assert.equal(generated.mapDefinition.props[0].coordinateSpace, "offset");
assert.deepEqual(getBattlefieldPropOffset(generated.mapDefinition.props[0], generated.mapDefinition), { x: 2, y: 3 });

console.log("Milestone 8C-3 battlefield prop coordinate migration tests passed.");
