import assert from "node:assert/strict";

import { prioritizeEnemyCombatTargets } from "../src/utils/ai/routedTargetPriority.js";

const attacker = { id: "knight-2", name: "Knight #2", side: "enemy", team: "enemy" };
const distantRoutedTarget = {
  id: "longbowman-routed",
  name: "Longbowman",
  side: "party",
  team: "party",
  state: { moraleState: "routed" },
};
const activeOpponent = {
  id: "longbowman-active",
  name: "Longbowman",
  side: "party",
  team: "party",
  state: { moraleState: "steady" },
};
const positions = {
  "knight-2": { x: 10, y: 10 },
  "longbowman-routed": { x: 24, y: 10 },
  "longbowman-active": { x: 11, y: 10 },
};

const orderedTargets = prioritizeEnemyCombatTargets({
  attacker,
  candidates: [distantRoutedTarget, activeOpponent],
  positions,
  calculateDistance: (a, b) => Math.abs(a.x - b.x) * 5,
});

assert.equal(
  orderedTargets[0]?.id,
  activeOpponent.id,
  "enemy targeting should prefer an active opponent over a distant routed target",
);

console.log("distant routed target ignored while active opponents remain test passed");
