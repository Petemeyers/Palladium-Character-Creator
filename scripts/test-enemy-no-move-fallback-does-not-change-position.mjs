import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(source, /let noMoveFallbackPositionSnapshot = null/);
assert.match(source, /enemy no-move fallback position snapshot: actor=/);
assert.match(source, /before=\(\$\{noMoveFallbackPositionSnapshot\.x\},\$\{noMoveFallbackPositionSnapshot\.y\}\)/);
assert.match(source, /approachFinalizerSource === "enemy-ai-no-move-fallback"/);
assert.match(source, /enemy no-move fallback position changed unexpectedly: actor=/);
assert.match(source, /source=\$\{approachFinalizerSource\}/);

console.log("enemy no-move fallback position invariant tests passed");
