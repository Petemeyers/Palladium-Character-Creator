import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");

const scheduleStart = source.indexOf("const schedulePlayerAIEndTurn =");
assert.notEqual(scheduleStart, -1, "schedulePlayerAIEndTurn exists");

const scheduleEnd = source.indexOf("const clearSeparatedGrappleForPlayerAI", scheduleStart);
assert.notEqual(scheduleEnd, -1, "schedulePlayerAIEndTurn block has an identifiable end");

const block = source.slice(scheduleStart, scheduleEnd);

const continueIndex = block.indexOf("const canContinuePlayerAI");
const finalizerIndex = block.indexOf("canFinalizePlayerAITurn(source, { logAccepted: true, consume: true })");
assert.ok(continueIndex > -1, "player AI end-turn helper evaluates same-fighter continuation");
assert.ok(finalizerIndex > -1, "player AI end-turn helper still accepts real finalizers");
assert.ok(
  continueIndex < finalizerIndex,
  "same-fighter action continuation must be decided before accepting a turn finalizer",
);
assert.match(
  block,
  /playerTurnInFlightKeyRef\.current === turnKey[\s\S]*playerTurnInFlightKeyRef\.current = null/,
  "action-level in-flight latch is released before same-fighter continuation",
);
assert.match(
  block,
  /claimPlayerAIContinuation\(\{[\s\S]*source: "player-ai-remaining-action-continuation"/,
  "remaining-action continuation claims ownership instead of minting a turn finalizer",
);
assert.match(
  block,
  /non-improving/,
  "non-improving approach is treated as an explicit terminal/pass source",
);

const inFlightBlockIndex = source.indexOf("player AI in-flight ownership:");
const orphanRepairIndex = source.indexOf("player AI orphaned turn repaired:");
assert.ok(inFlightBlockIndex > -1, "player AI in-flight ownership diagnostic is present");
assert.ok(orphanRepairIndex > inFlightBlockIndex, "orphaned player AI turns are diagnosed and repaired");

console.log("✅ large-battle player-AI continuation/finalizer separation tests passed");
