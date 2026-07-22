import assert from "node:assert/strict";
import { normalizeReferenceCombatActor, resolveCanonicalCombatActorKey } from "../src/utils/combat/normalizeCombatActorSchema.js";
import { validateCombatActor } from "../src/utils/combat/validateCombatActor.js";
import { repairStagedSavedCharacterEntry } from "../src/utils/publicStagedRosterStorage.js";

const cases = [
  {
    id: "saved-party-knight-17", sourceCharacterId: "knight", name: "Knight #1", team: "party", type: "player",
    alignment: "Principled (Good)", selectedLoadout: [{ name: "Long Sword", damage: "1d8" }],
  },
  {
    id: "enemy-runtime-41", sourceActorKey: "knight", name: "Knight #2", team: "enemy", type: "enemy",
    alignment: "Aberrant (Evil)", selectedLoadout: [{ name: "Short Sword", damage: "1d6" }],
  },
  {
    id: "compat-runtime-92", compatibilityId: "knight", name: "Knight #3", team: "enemy", type: "enemy",
    alignment: "Scrupulous (Good)", selectedLoadout: [{ name: "Ritual Dagger", damage: "1d4" }],
  },
];

const normalized = cases.map((actor) => normalizeReferenceCombatActor(actor, { source: "live-log-regression" }));
for (const [index, result] of normalized.entries()) {
  const actor = result.normalizedActor;
  assert.equal(actor.actorKey, "knight");
  assert.equal(actor.combatActorSchemaVersion, 1);
  assert.equal(actor.species, "human");
  assert.equal(actor.creatureType, "humanoid");
  assert.equal(actor.size, "medium");
  assert.ok(actor.armorProfile?.profileKey);
  assert.ok(actor.weaponProfiles.every((profile) => profile.profileKey && profile.weaponId));
  assert.match(actor.alignment, /^(lawful|neutral|chaotic)-(good|neutral|evil)$|^true-neutral$/);
  assert.doesNotMatch(actor.alignment, /principled|scrupulous|aberrant/i);
  assert.equal(actor.weaponProfiles[0].name, ["Long Sword", "Short Sword", "Ritual Dagger"][index]);
  const validation = validateCombatActor(actor, { normalize: true });
  assert.equal(validation.compatibilityFallbacks.includes("unmigrated-actor-schema"), false);
  assert.equal(validation.warnings.some((warning) => warning.code === "inventory-weapon-without-profile"), false);
}
assert.deepEqual(normalized.map(({ normalizedActor }) => [normalizedActor.species, normalizedActor.creatureType, normalizedActor.size]), [
  ["human", "humanoid", "medium"], ["human", "humanoid", "medium"], ["human", "humanoid", "medium"],
]);

const unsupported = normalizeReferenceCombatActor({
  id: "unsupported-knight", actorKey: "knight", team: "party",
  selectedLoadout: [{ name: "Moon Blade", damage: "9d9" }],
}, { source: "setup" });
assert.equal(unsupported.normalizedActor.weaponProfiles[0].profileKey, "weapon.long-sword");
assert.equal(unsupported.diagnostics.filter((event) => event.eventType === "combat-actor-unsupported-weapon-replaced").length, 1);

const repaired = repairStagedSavedCharacterEntry(
  { id: "staged-opaque", side: "player", autoRollCharacter: { id: "saved-opaque" } },
  { _id: "saved-opaque", name: "Sir Rowan", publicClassName: "Knight", species: "Human" },
);
assert.equal(repaired.combatActorMigrationAlias, "knight");
assert.equal(resolveCanonicalCombatActorKey(repaired.autoRollCharacter).actorKey, "knight");

console.log("canonical Knight live-instance migration passed (3 instances)");
