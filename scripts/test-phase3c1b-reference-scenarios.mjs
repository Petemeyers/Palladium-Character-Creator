import assert from "node:assert/strict";
import { createPhase3C1BExtendedReachScenario, createPhase3C1BProjectileScenario } from "../src/utils/combat/phase3c1bScenarios.js";

const projectile = createPhase3C1BProjectileScenario();
assert.equal(projectile.party.length, 3);
assert.equal(projectile.opponents.length, 3);
assert.equal(new Set([...projectile.party, ...projectile.opponents].map((actor) => actor.actorKey)).size, 6);
assert.ok(projectile.party.every((actor) => actor.combatActorSchemaVersion === 1));
const reach = createPhase3C1BExtendedReachScenario();
assert.equal(reach.publicActorBodiesCreated, false);
assert.deepEqual(reach.fixtures.map(({ weapon }) => weapon.deliveryType), ["extended-melee", "extended-melee"]);
assert.ok(reach.fixtures.every(({ weapon }) => !weapon.ammunitionType));
console.log("Phase 3C1B reference scenarios passed: 7");
