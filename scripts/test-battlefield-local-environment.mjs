import assert from "node:assert/strict";
import { BATTLEFIELD_LIGHTING, normalizeBattlefieldMap } from "../src/utils/maps/battlefieldMapAuthority.js";
import { resolveBattlefieldLocalEnvironmentAtCell } from "../src/utils/maps/battlefieldLocalEnvironmentAuthority.js";
import { resolveActorVisibility, resolveBattlefieldLineOfSight } from "../src/utils/maps/battlefieldVisibilityAuthority.js";

const emptyGrid = Array.from({ length: 8 }, (_, y) => Array.from({ length: 10 }, (_, x) => ({ x, y, terrain: "grass", terrainType: "grass", elevation: 0 })));
const map = normalizeBattlefieldMap({
  id: "local-light-smoke",
  name: "Local Light Smoke",
  width: 10,
  height: 8,
  grid: emptyGrid,
  environment: { lighting: BATTLEFIELD_LIGHTING.DARKNESS },
  props: [
    { id: "torch-1", type: "torch", x: 2, y: 3, q: 2, r: 3, coordinateSpace: "offset" },
    { id: "smoke-1", type: "smoke", x: 5, y: 3, q: 5, r: 3, coordinateSpace: "offset", scale: 1 },
  ],
});

const lit = resolveBattlefieldLocalEnvironmentAtCell({ battlefield: map, position: { x: 2, y: 3 } });
assert(lit.illumination > 0.5);
assert(lit.lightRadiusFeet >= 30);

const observer = { id: "a", isEnemy: false };
const nearTarget = { id: "b", isEnemy: true };
const visible = resolveActorVisibility({ observer, target: nearTarget, positions: { a: { x: 2, y: 3 }, b: { x: 6, y: 2 } }, battlefield: map });
assert.equal(visible.visible, true, `torch should extend darkness visibility: ${visible.reason}`);

const smokeLos = resolveBattlefieldLineOfSight({ from: { x: 1, y: 3 }, to: { x: 8, y: 3 }, battlefield: map });
assert.equal(smokeLos.hasLineOfSight, false);
assert(["smoke-concealment", "terrain-concealment-blocked"].includes(smokeLos.blockedBy?.type) || smokeLos.reason === "terrain-concealment-blocked");
console.log("battlefield local environment: ok");
