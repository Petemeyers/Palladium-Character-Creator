import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/pages/CombatPage.jsx", "utf8");

assert.match(source, /transitionLogicalInitiativeTurn\(record\.initiativeTurnId,\s*"waiting-manual"/, "logical turn registry should support waiting-manual state");
assert.match(source, /executionOwner:\s*null/, "new logical turns should start with no execution owner");
assert.match(source, /executionOwner:\s*"manual-player"/, "manual wait should be owned by manual-player");
assert.match(source, /executionOwner:\s*"player-ai"/, "player AI execution should claim player-ai ownership");
assert.match(source, /executionStarted:\s*false/, "manual wait should not count as execution started");
assert.match(source, /executionStarted:\s*true/, "AI entry should mark execution started");

assert.match(source, /disposition:\s*"existing-manual-wait"/, "manual waiting turn should not be active continuation");
assert.match(source, /disposition:\s*"existing-active-execution"/, "AI-owned active execution should be distinguished from continuation");
assert.match(source, /continuationOwnsTurn[\s\S]*disposition:\s*"existing-active-continuation"/, "active continuation should require continuation ownership");

assert.match(source, /const resumeManualPartyTurnWithAI = useCallback/, "manual-to-AI takeover helper should exist");
assert.match(source, /eventType:\s*"player-control-takeover-started"/);
assert.match(source, /eventType:\s*"player-control-takeover-accepted"/);
assert.match(source, /eventType:\s*"player-control-takeover-completed"/);
assert.match(source, /eventType:\s*"player-control-takeover-rejected"/);
assert.match(source, /state !== "waiting-manual"/, "takeover should require waiting-manual state");
assert.match(source, /record\.executionOwner !== "manual-player"/, "takeover should require manual-player ownership");

const toggleBlock = source.slice(source.indexOf("AI toggle resume: scheduling player AI"));
assert.match(toggleBlock, /resumeManualPartyTurnWithAI\(/, "AI toggle should call takeover helper");
assert.doesNotMatch(
  toggleBlock.slice(0, toggleBlock.indexOf("} else {")),
  /startTurnOnce\(currentFighter,\s*liveIndex,\s*"ai-toggle-resume"\)/,
  "AI toggle takeover must not call generic turn scheduler",
);

assert.match(source, /eventType:\s*"turn-scheduler-paused-for-manual-control"/);
assert.match(source, /eventType:\s*"player-turn-entry-owner-mismatch"/);
assert.match(source, /handlePlayerAITurnRef\.current\?\.\(activeFighter,\s*\{[\s\S]*takeover:\s*true/);

console.log("✅ Phase 3B1 player manual-to-AI takeover source tests passed");
