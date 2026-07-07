import assert from "node:assert/strict";
import fs from "node:fs";

import { resolveTurnDiagnosticSource } from "../src/utils/turnSchedulerDiagnostics.js";

assert.equal(resolveTurnDiagnosticSource({
  source: "unknown",
  activeGrapple: true,
  processingPlayerAI: true,
}), "player-ai-grapple");
assert.equal(resolveTurnDiagnosticSource({
  activeGrapple: true,
}), "grapple-finalizer");

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /activeGrapple: Boolean\(activeGrappleActionIdRef\.current\)/);

console.log("grapple busy diagnostic source tests passed");
