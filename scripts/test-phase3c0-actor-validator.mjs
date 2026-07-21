import assert from "node:assert/strict";
import { getCanonicalCombatActorDefinition } from "../src/data/canonicalCombatActors.js";
import { normalizeReferenceCombatActor } from "../src/utils/combat/normalizeCombatActorSchema.js";
import { validateCombatActor } from "../src/utils/combat/validateCombatActor.js";

for (const key of ["knight", "goblin-warrior", "minotaur"]) {
  const result = validateCombatActor({ ...getCanonicalCombatActorDefinition(key), team: key === "knight" ? "party" : "enemy" });
  assert.equal(result.valid, true, `${key}: ${JSON.stringify(result.errors)}`);
  assert.equal(result.blocksCombatStart, false);
}
const identity = validateCombatActor({ ...getCanonicalCombatActorDefinition("goblin-warrior"), species: "human", team: "enemy" });
assert.equal(identity.valid, false);
assert.ok(identity.diagnostics.some((event) => event.eventType === "combat-actor-identity-contradiction"));

const canonicalKnight = getCanonicalCombatActorDefinition("knight");
const contradictory = structuredClone(canonicalKnight);
contradictory.team = "party";
contradictory.weaponProfiles[0].handedness = "one-handed";
contradictory.weaponProfiles[0].handsRequired = 2;
contradictory.attacks[0] = { ...contradictory.attacks[0], damage: "9d9" };
const weaponResult = validateCombatActor(contradictory);
assert.ok(weaponResult.errors.some((error) => error.code === "two-handed-marked-one-handed"));
assert.ok(weaponResult.errors.some((error) => error.code === "attack-profile-damage-contradiction"));

const alignment = validateCombatActor({ ...canonicalKnight, team: "party", alignment: "Unknown Philosophical School" });
assert.ok(alignment.diagnostics.some((event) => event.eventType === "combat-actor-alignment-mapping-missing"));

const live = normalizeReferenceCombatActor({
  ...canonicalKnight, id: "live-knight", team: "party", position: { x: 9, y: 4 }, hex: { q: 3, r: 2 },
  currentHP: 10, currentStamina: 7, combatStamina: { current: 7, maximum: 28 },
  grappleState: { state: "grapple_ground", opponent: "enemy" }, surrenderState: { status: "offered" },
  initiativeTurnId: "round:4:knight", actionToken: "round:4:knight:2", initiativeIdentity: { round: 4, initiativeIndex: 1 },
}, { source: "setup-load" }).normalizedActor;
assert.deepEqual(live.position, { x: 9, y: 4 });
assert.deepEqual(live.hex, { q: 3, r: 2 });
assert.equal(live.currentHP, 10);
assert.equal(live.combatStamina.current, 7);
assert.equal(live.grappleState.opponent, "enemy");
assert.equal(live.surrenderState.status, "offered");
assert.equal(live.initiativeTurnId, "round:4:knight");
assert.equal(live.actionToken, "round:4:knight:2");
console.log("Phase 3C0 actor validator passed");
