import assert from "node:assert/strict";
import fs from "node:fs";

import { normalizePlayerGrappleDispatcherContext } from "../src/utils/ai/playerGrappleDispatcher.js";

const dispatcher = () => ({ terminal: true });
const continuationAuthorization = Object.freeze({
  continuationKey: "continuation-signature-2",
  initiativeTurnId: "initiative-signature-1",
  actorId: "player-knight",
  actionSequence: 2,
});
const rawContext = Object.freeze({
  actorId: "player-knight",
  dispatchGrappleTurnAction: dispatcher,
  continuationAuthorization,
  dispatcherChain: { outerDispatcherPresent: true },
});
const normalized = normalizePlayerGrappleDispatcherContext(rawContext);
assert.equal(normalized.dispatchGrappleTurnAction, dispatcher, "normalization must retain the exact function reference");
assert.equal(normalized.continuationAuthorization, continuationAuthorization, "normalization must retain authorization identity");
assert.equal(normalized.dispatcherChain.normalizedDispatcherPresent, true);

const playerTurnAI = fs.readFileSync("src/utils/ai/playerTurnAI.js", "utf8");
const combatPage = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");
assert.match(playerTurnAI, /dispatchGrappleTurnAction,\s*recoverMissingPlayerGrappleDispatcher/);
assert.match(playerTurnAI, /continuationAuthorization\s*=\s*context\.continuationAuthorization/);
assert.match(playerTurnAI, /dispatchGrappleTurnAction\([\s\S]*?continuationAuthorization,[\s\S]*?dispatcherChain:/);
assert.match(combatPage, /dispatchGrappleTurnAction:\s*executePlayerAIGrapple/);
assert.match(combatPage, /continuationAuthorization:\s*meta\?\.continuationAuthorization \|\| null/);
assert.doesNotMatch(
  playerTurnAI,
  /grappleDispatcher|dispatchGrappleAction|grappleActionDispatcher|onDispatchGrappleAction/,
  "player AI routing must not read dispatcher aliases",
);

console.log("✅ Phase 3B1 player grapple dispatcher signature runtime tests passed");
