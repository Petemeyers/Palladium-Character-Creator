import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(
  source,
  /finalizerMeta\?\.source === "enemy-ai-no-move-fallback"[\s\S]*finalizerMeta\?\.source === "enemy-ai-unresolved-turn-fallback"/,
  "fallback settlement guard should apply to no-move and unresolved fallback finalizers",
);
assert.match(
  source,
  /isFallbackFinalizer && fightersNow\[nextIndex\]\?\.id === acceptedActingActor\?\.id/,
  "fallback settlement should detect next actor equal to accepted actor",
);
assert.match(
  source,
  /fallback finalizer cannot hand back to same actor; advancing to next active combatant/,
  "same-actor fallback settlement should emit guard diagnostic",
);

console.log("enemy fallback cannot settle next as same actor tests passed");
