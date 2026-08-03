import assert from "node:assert/strict";
import fs from "node:fs";
const runtime = fs.readFileSync("src/utils/combat/tacticalActionRuntime.js", "utf8");
const page = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");
for (const contract of ["createCanonicalPostParryOffer", "executeCanonicalPostParryResponse", "progressTacticalPostParryWindows", "postParryRuntime"]) assert.match(runtime, new RegExp(contract));
for (const contract of ["resolveTacticalPostParryResponse", "executeCanonicalGrappleActionRef", "tactical-post-parry-controls", "submitManualTacticalPostParryResponse", "tactical-post-parry-riposte"]) assert.match(page, new RegExp(contract));
assert.match(page, /suppressSequentialTurnAdvance: true/);
console.log("tactical post-parry source integration tests passed");
