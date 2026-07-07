import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { shouldAllowSurvivalFinalizerHandoff } from "../src/utils/aiToggleResume.js";

const routedPartyActor = {
  id: "knight-2",
  name: "Knight #2",
  team: "party",
  state: { moraleState: "routed" },
  remainingActions: 1,
};

assert.equal(
  shouldAllowSurvivalFinalizerHandoff({
    source: "player-ai",
    actor: routedPartyActor,
  }),
  true,
  "Routed player-ai finalizer should continue instead of entering manual wait.",
);

const combatPage = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(combatPage, /allowSurvivalFinalizerHandoff/);
assert.match(combatPage, /manualPlayerWaiting && !allowManualNoActionEndTurn/);
assert.match(combatPage, /survivalHandoff=\$\{allowSurvivalFinalizerHandoff\}/);

console.log("manual-toggle routed-player finalizer guard tests passed");
