import assert from "node:assert/strict";
import fs from "node:fs";

import { resolveTurnDiagnosticSource } from "../src/utils/turnSchedulerDiagnostics.js";

assert.equal(resolveTurnDiagnosticSource({
  source: "unknown",
  movementActive: true,
  processingEnemy: true,
}), "enemy-move-finalizer");
assert.notEqual(resolveTurnDiagnosticSource({ source: "unknown" }), "unknown");

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /movementActive: Boolean\(/);
assert.match(source, /source=\$\{diagnosticSource\}/);
assert.doesNotMatch(source, /\(delayOverride = null, source = "unknown", options = \{\}\) =>/);

console.log("movement busy diagnostic source tests passed");
