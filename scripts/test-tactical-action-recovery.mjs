import assert from "node:assert/strict";
import { advanceTacticalActionRuntime, createTacticalActionRuntime, registerTacticalAction } from "../src/utils/combat/tacticalActionRuntime.js";
import { createTacticalActionIntent } from "../src/utils/combat/tacticalActionIntent.js";

const fighters = [{ id: "a", team: "party" }, { id: "b", team: "enemy" }];
const runtime = createTacticalActionRuntime({ generationId: 1, combatSession: 1 });
const intent = createTacticalActionIntent({ actionIntentId: "heavy", generationId: 1, combatSession: 1, actorId: "a", targetActorId: "b", weaponId: "maul", timingKey: "heavyMeleeAttack", createdAtPulse: 0 }).intent;
registerTacticalAction(runtime, intent);
await advanceTacticalActionRuntime({ runtime, pulseIndex: 2, fighters, executeCanonicalAttack: () => ({ accepted: true }) });
await advanceTacticalActionRuntime({ runtime, pulseIndex: 3, fighters, executeCanonicalAttack: () => ({ accepted: true }) });
assert.equal(runtime.recoveryByActor.get("a").recoveryUntilPulse, 5);
assert.equal(registerTacticalAction(runtime, { ...intent, actionIntentId: "again", createdAtPulse: 2 }).reason, "actor-recovering");
await advanceTacticalActionRuntime({ runtime, pulseIndex: 4, fighters, executeCanonicalAttack: () => ({ accepted: true }) });
assert.equal(runtime.recoveryByActor.has("a"), true);
await advanceTacticalActionRuntime({ runtime, pulseIndex: 5, fighters, executeCanonicalAttack: () => ({ accepted: true }) });
assert.equal(runtime.recoveryByActor.has("a"), false);
const boundaryIntent = createTacticalActionIntent({
  actionIntentId: "boundary-next-action",
  generationId: 1,
  combatSession: 1,
  actorId: "a",
  targetActorId: "b",
  weaponId: "dagger",
  timingKey: "daggerAttack",
  createdAtPulse: 5,
}).intent;
assert.equal(registerTacticalAction(runtime, boundaryIntent).accepted, true, "new primary action is legal at the satisfied recovery boundary");
console.log("tactical action recovery tests passed");
