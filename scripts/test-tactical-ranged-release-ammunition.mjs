import assert from "node:assert/strict";
import { createTacticalActionIntent, transitionTacticalAction } from "../src/utils/combat/tacticalActionIntent.js";
import { createTacticalActionRuntime, claimTacticalExecution } from "../src/utils/combat/tacticalActionRuntime.js";
import { resolveTacticalAttackIntent } from "../src/utils/combat/resolveTacticalAttackIntent.js";

const created = createTacticalActionIntent({ actionIntentId: "arrow", generationId: 1, combatSession: 1, actorId: "a", targetActorId: "b", weaponId: "longbow", actionType: "ranged-attack", timingKey: "longbowRushedShot" }).intent;
const ready = transitionTacticalAction(transitionTacticalAction(created, "preparing").intent, "ready").intent;
const runtime = createTacticalActionRuntime({ generationId: 1, combatSession: 1 });
let ammo = 0;
let attacks = 0;
const request = () => resolveTacticalAttackIntent({ intent: ready, pulseIndex: 2, claimExecution: (key) => claimTacticalExecution(runtime, key), spendCanonicalAmmunition: () => { ammo += 1; return { accepted: true, spent: 1 }; }, executeCanonicalAttack: () => { attacks += 1; return { accepted: true }; } });
assert.equal((await request()).accepted, true);
assert.equal((await request()).accepted, false);
assert.equal(ammo, 1);
assert.equal(attacks, 1);

const thrownRuntime = createTacticalActionRuntime({ generationId: 1, combatSession: 1 });
const thrown = await resolveTacticalAttackIntent({
  intent: { ...ready, actionIntentId: "arrow-throw", state: "ready" },
  pulseIndex: 3,
  claimExecution: (key) => claimTacticalExecution(thrownRuntime, key),
  spendCanonicalAmmunition: () => { throw new Error("ammo callback failed"); },
  executeCanonicalAttack: () => assert.fail("attack cannot execute after ammunition callback failure"),
});
assert.equal(thrown.accepted, false);
assert.equal(thrown.reason, "canonical-ammunition-callback-threw");

const misfireRuntime = createTacticalActionRuntime({ generationId: 1, combatSession: 1 });
let misfireReleaseEvents = 0;
const misfire = await resolveTacticalAttackIntent({
  intent: { ...ready, actionIntentId: "arrow-misfire", state: "ready" },
  pulseIndex: 4,
  claimExecution: (key) => claimTacticalExecution(misfireRuntime, key),
  spendCanonicalAmmunition: () => ({ accepted: true, admissionOnly: true }),
  executeCanonicalAttack: () => ({ accepted: true, ammunitionSpent: 0, projectileReleased: false }),
  onRelease: () => { misfireReleaseEvents += 1; },
});
assert.equal(misfire.accepted, true, "canonical non-release fumble remains a completed attack outcome");
assert.equal(misfireReleaseEvents, 0, "non-release fumble does not announce or claim a projectile release");
console.log("tactical ranged release ammunition tests passed");
