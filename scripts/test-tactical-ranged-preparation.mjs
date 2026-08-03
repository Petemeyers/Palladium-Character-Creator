import assert from "node:assert/strict";
import { createTacticalActionRuntime, advanceTacticalActionRuntime, cancelTacticalAction, registerTacticalAction } from "../src/utils/combat/tacticalActionRuntime.js";
import { createTacticalActionIntent } from "../src/utils/combat/tacticalActionIntent.js";

const fighters = [{ id: "archer", team: "party" }, { id: "target", team: "enemy" }];
const bowIntent = (id = "shot") => createTacticalActionIntent({ actionIntentId: id, generationId: 3, combatSession: 4, actorId: "archer", targetActorId: "target", weaponId: "longbow", actionType: "ranged-attack", timingKey: "longbowStandardShot", createdAtPulse: 0 }).intent;
const runtime = createTacticalActionRuntime({ generationId: 3, combatSession: 4 });
let ammo = 0;
let rolls = 0;
registerTacticalAction(runtime, bowIntent());
for (let pulse = 0; pulse < 3; pulse += 1) await advanceTacticalActionRuntime({ runtime, pulseIndex: pulse, fighters, spendCanonicalAmmunition: () => { ammo += 1; return { accepted: true }; }, executeCanonicalAttack: () => { rolls += 1; return { accepted: true, hit: false }; } });
assert.equal(ammo, 0);
assert.equal(rolls, 0);
await advanceTacticalActionRuntime({ runtime, pulseIndex: 3, fighters, spendCanonicalAmmunition: () => { ammo += 1; return { accepted: true }; }, executeCanonicalAttack: () => { rolls += 1; return { accepted: true, hit: false }; } });
assert.equal(ammo, 1, "released miss spends exactly one projectile");
assert.equal(rolls, 1);

const canceled = createTacticalActionRuntime({ generationId: 3, combatSession: 4 });
registerTacticalAction(canceled, bowIntent("canceled"));
assert.equal(cancelTacticalAction(canceled, "archer").accepted, true);
await advanceTacticalActionRuntime({ runtime: canceled, pulseIndex: 3, fighters, spendCanonicalAmmunition: () => { ammo += 1; }, executeCanonicalAttack: () => { rolls += 1; } });
assert.equal(ammo, 1);

const interrupted = createTacticalActionRuntime({ generationId: 3, combatSession: 4 });
registerTacticalAction(interrupted, bowIntent("interrupted"));
await advanceTacticalActionRuntime({ runtime: interrupted, pulseIndex: 1, fighters: [{ ...fighters[0], unconscious: true }, fighters[1]], spendCanonicalAmmunition: () => { ammo += 1; }, executeCanonicalAttack: () => { rolls += 1; } });
assert.equal(ammo, 1);
assert.equal(interrupted.terminalHistory.at(-1).state, "interrupted");
console.log("tactical ranged preparation tests passed");
