import assert from "node:assert/strict";
import fs from "node:fs";

const combatPage = fs.readFileSync("src/pages/CombatPage.jsx", "utf8");

const moraleStart = combatPage.indexOf("const fraidereRoutingFleeAction");
const moraleEnd = combatPage.indexOf("const preserveTrainingWithstamina", moraleStart);
assert.ok(moraleStart > 0 && moraleEnd > moraleStart, "routed morale action helper should be present");
const moraleHelper = combatPage.slice(moraleStart, moraleEnd);

assert.match(moraleHelper, /const completeMoraleAction = \(\{/);
assert.match(moraleHelper, /eventType:\s*"morale-action-completed"/);
assert.match(moraleHelper, /actionSpent:\s*true/);
assert.match(moraleHelper, /actionsSpent:\s*1/);
assert.match(moraleHelper, /initiativeActionSequenceRef\.current\s*=/);
assert.match(moraleHelper, /const actionToken = \[/);
assert.match(moraleHelper, /releaseActiveGrappleForMorale/);
assert.match(moraleHelper, /endGrappleRelationship\(\{/);
assert.match(moraleHelper, /eventType:\s*"grapple-state-ended"/);

assert.doesNotMatch(
  moraleHelper,
  /scheduleEndTurn(?:Ref)?\.current|scheduleEndTurn\(/,
  "routed morale helper must not schedule turns directly",
);

const explicitTurnEndingBlock = combatPage.slice(
  combatPage.indexOf("const explicitTurnEndingEffect ="),
  combatPage.indexOf("const fighterIncapacitated =", combatPage.indexOf("const explicitTurnEndingEffect =")),
);
assert.doesNotMatch(
  explicitTurnEndingBlock,
  /cower/,
  "cower label must not implicitly end a logical turn",
);

assert.match(combatPage, /eventType:\s*"completed-turn-same-actor-reschedule"/);
assert.match(combatPage, /eventType:\s*"turn-counter-advance-rejected"/);
assert.match(combatPage, /\(!explicitTurnEndingEffect \|\| forceSameActorContinuation\)/);

for (const source of ["player-turn-start", "player-ai-routing", "enemy-routing"]) {
  const sourceIndex = combatPage.indexOf(`fraidereRoutingFleeAction`, combatPage.indexOf(`"${source}"`) - 500);
  assert.ok(sourceIndex > 0, `${source} routed call should exist`);
  const block = combatPage.slice(Math.max(0, sourceIndex - 220), sourceIndex + 1000);
  assert.match(block, /const moraleActionResult = fraidereRoutingFleeAction\(/);
  assert.ok(
    /resolveCombatActionCompletionRef\.current\?\.\(\{|resolveCombatActionCompletion\(\{/.test(block),
    `${source} should route morale action through completion arbiter`,
  );
  assert.doesNotMatch(block, /horror-action-consumed"\);\s*return/s, `${source} should not directly schedule horror-action-consumed after morale action`);
}

assert.match(
  combatPage,
  /resolveCombatActionCompletionRef\.current\?\.\(\{[\s\S]*source:\s*moraleActionResult\.source \|\| "player-turn-start-morale"/,
  "pre-declaration routed player turn-start path should use the arbiter ref bridge",
);

console.log("✅ Phase 3B1 morale completion source contract passed");
