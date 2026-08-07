import assert from "node:assert/strict";
import fs from "node:fs";
import {
  INITIATIVE_ACTIONS_MODE,
  allowsSameActorActionContinuation,
} from "../src/utils/combat/initiativeActionTiming.js";

const combat = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.equal(allowsSameActorActionContinuation(INITIATIVE_ACTIONS_MODE), false);
assert.equal(allowsSameActorActionContinuation("sequential"), true);

// The generic end-turn gate must hand off after one action in Initiative Actions.
assert.match(
  combat,
  /allowsSameActorActionContinuation\(combatTimingModeRef\.current\) &&\s*isCapableWithActions/,
);

// Player and enemy AI must not schedule same-actor remaining-action continuations.
assert.match(
  combat,
  /const canContinuePlayerAI =\s*allowsSameActorActionContinuation\(combatTimingModeRef\.current\)/,
);
assert.match(
  combat,
  /const canContinue =\s*allowsSameActorActionContinuation\(combatTimingModeRef\.current\)/,
);

// Player-AI snapshot merges must not overwrite the canonical tactical position.
assert.match(
  combat,
  /const authoritativePosition =\s*positionsRef\.current\?\.\[live\.id\]/,
);
assert.match(
  combat,
  /position: \{ \.\.\.authoritativePosition \}/,
);

assert.match(combat, /player AI movement destination clamped/);

console.log("initiative actions handoff regression: passed");
