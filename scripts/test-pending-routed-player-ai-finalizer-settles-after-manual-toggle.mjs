import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { shouldAllowSurvivalFinalizerHandoff } from "../src/utils/aiToggleResume.js";

assert.equal(
  shouldAllowSurvivalFinalizerHandoff({
    source: "horror-action-consumed",
    actor: { id: "knight-2", team: "party" },
  }),
  true,
  "Explicit panic/horror consumed-action finalizer should bypass manual wait.",
);

assert.equal(
  shouldAllowSurvivalFinalizerHandoff({
    source: "player-ai-routed-move",
    actor: { id: "knight-2", team: "party" },
  }),
  true,
  "Explicit routed-move finalizer should bypass manual wait.",
);

const combatPage = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(
  combatPage,
  /pending routed survival action continues automatic handoff fighter=\$\{formatCombatActorLabel\(currentFighter/,
  "Manual toggle should log that a pending routed survival handoff continues.",
);
assert.match(combatPage, /actingActorSnapshot: playerAiActingActorSnapshot/);

console.log("pending routed player-ai finalizer settlement tests passed");
