import assert from "node:assert/strict";
import { createBattlefieldProp, getBattlefieldPropDefinition, getBattlefieldPropOffset, normalizeBattlefieldProp } from "../src/utils/maps/battlefieldPropCatalog.js";

assert.equal(getBattlefieldPropDefinition("torch").lightSource.radiusFeet, 30);
assert.equal(getBattlefieldPropDefinition("smoke").localAtmosphere.type, "smoke");
assert.equal(getBattlefieldPropDefinition("wall").blocksLineOfSight, true);
const torch = createBattlefieldProp("torch", { x: 4, y: 5, coordinateSpace: "offset" });
assert.equal(torch.blocksMovement, false);
assert.equal(torch.lightSource.radiusFeet, 30);
assert.deepEqual(getBattlefieldPropOffset(torch, { width: 20, height: 20 }), { x: 4, y: 5 });
const legacyCrate = normalizeBattlefieldProp({ type: "crate", q: 2, r: 3, coordinateSpace: "axial" });
assert.equal(legacyCrate.blocksMovement, true);
console.log("battlefield prop catalog: ok");
