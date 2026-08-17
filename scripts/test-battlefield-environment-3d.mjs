import assert from "node:assert/strict";
import { BATTLEFIELD_FOG, BATTLEFIELD_LIGHTING } from "../src/utils/maps/battlefieldMapAuthority.js";
import { getBattlefieldEnvironment3DSignature, resolveBattlefieldEnvironment3D } from "../src/utils/three/battlefieldEnvironment3D.js";

const daylight = resolveBattlefieldEnvironment3D({ environment: { lighting: BATTLEFIELD_LIGHTING.BRIGHT_DAYLIGHT, environmentalFog: { type: BATTLEFIELD_FOG.CLEAR } } });
const darkness = resolveBattlefieldEnvironment3D({ environment: { lighting: BATTLEFIELD_LIGHTING.DARKNESS, environmentalFog: { type: BATTLEFIELD_FOG.CLEAR } } });
const denseFog = resolveBattlefieldEnvironment3D({ environment: { lighting: BATTLEFIELD_LIGHTING.DAYLIGHT, environmentalFog: { type: BATTLEFIELD_FOG.DENSE_FOG, density: 0.9 } } });

assert.equal(daylight.fog.enabled, false);
assert(darkness.exposure < daylight.exposure);
assert(darkness.sun.intensity < daylight.sun.intensity);
assert.equal(denseFog.fog.enabled, true);
assert(denseFog.fog.near < denseFog.fog.far);
assert(denseFog.fog.far < 45);
assert.equal(getBattlefieldEnvironment3DSignature({ environment: { lighting: BATTLEFIELD_LIGHTING.DAYLIGHT, environmentalFog: { type: BATTLEFIELD_FOG.DENSE_FOG, density: 0.9 } } }), getBattlefieldEnvironment3DSignature({ environment: { lighting: BATTLEFIELD_LIGHTING.DAYLIGHT, environmentalFog: { type: BATTLEFIELD_FOG.DENSE_FOG, density: 0.9 } } }));

console.log("Milestone 8C-3 Three.js battlefield environment tests passed.");
