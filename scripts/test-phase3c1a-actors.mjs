import assert from "node:assert/strict";
import { getCanonicalCombatActorDefinition } from "../src/data/canonicalCombatActors.js";
import { humanFighters } from "../src/data/humanFighters.js";
import { PUBLIC_ENEMIES } from "../src/data/publicEnemies.js";
import { getSelectableActorById } from "../src/data/selectableActors.js";
import { getCombatIconAppearance } from "../src/utils/presentation/getCombatIconAppearance.js";
import { adaptPublicEnemyToCombatant } from "../src/utils/publicEnemyCombatAdapter.js";
import { repairStagedSavedCharacterEntry } from "../src/utils/publicStagedRosterStorage.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";
import { normalizeReferenceCombatActor, resolveCanonicalCombatActorKey } from "../src/utils/combat/normalizeCombatActorSchema.js";
import { validateCombatActor } from "../src/utils/combat/validateCombatActor.js";

const ACTOR_KEYS = ["squire", "man-at-arms", "spearman", "brigand", "bandit", "guard", "veteran-knight", "orc", "cultist"];
const NINE_GRID = new Set(["lawful-good", "neutral-good", "chaotic-good", "lawful-neutral", "true-neutral", "chaotic-neutral", "lawful-evil", "neutral-evil", "chaotic-evil"]);
const runtime = (actorKey, team = "enemy", id = `${team}:${actorKey}`) => normalizeReferenceCombatActor({
  ...getCanonicalCombatActorDefinition(actorKey), id, team, side: team, battleSide: team,
}).normalizedActor;

for (const actorKey of ACTOR_KEYS) {
  const definition = getCanonicalCombatActorDefinition(actorKey);
  assert.ok(definition, `${actorKey} has a canonical definition`);
  assert.equal(definition.actorKey, actorKey);
  assert.equal(definition.combatActorSchemaVersion, 1);
  assert.equal(definition.creatureType, "humanoid");
  assert.equal(definition.size, "medium");
  assert.ok(definition.grappleProfile);
  assert.ok(definition.surrenderProfile);
  assert.ok(NINE_GRID.has(definition.alignment));
  assert.equal(definition.alignment, definition.surrenderProfile.alignmentBehaviorMappingKey);
  assert.equal(definition.weaponProfiles.every((profile) => profile.profileKey && profile.weaponId), true);
  assert.equal(definition.inventory.every((item) => definition.weaponProfiles.some((profile) => profile.profileKey === item.profileKey)), true);
  const validation = validateCombatActor({ ...definition, team: "enemy", side: "enemy", battleSide: "enemy" });
  assert.equal(validation.valid, true, `${actorKey}: ${JSON.stringify(validation.errors)}`);
  assert.equal(validation.warnings.some((warning) => warning.code === "inventory-weapon-without-profile"), false);
}
assert.equal(getCanonicalCombatActorDefinition("orc").species, "orc", "non-human humanoid is not converted to human");

for (const actorKey of ["squire", "man-at-arms", "spearman", "brigand"]) {
  const compatibility = humanFighters.find((actor) => actor.id === actorKey);
  assert.equal(compatibility.actorKey, actorKey);
  assert.equal(compatibility.combatActorSchemaVersion, 1);
  const normalized = normalizeReferenceCombatActor({ ...compatibility, id: `compat:${actorKey}`, team: "enemy" }).normalizedActor;
  assert.deepEqual(normalized.weaponProfiles, getCanonicalCombatActorDefinition(actorKey).weaponProfiles);
}

for (const actorKey of ["bandit", "guard", "orc", "cultist"]) {
  const publicActor = PUBLIC_ENEMIES.find((actor) => actor.id === actorKey);
  const adapted = adaptPublicEnemyToCombatant(publicActor);
  assert.equal(adapted.ok, true);
  assert.equal(adapted.combatant.actorKey, actorKey);
  assert.deepEqual(adapted.combatant.weaponProfiles, getCanonicalCombatActorDefinition(actorKey).weaponProfiles);
}

for (const actorKey of ["spearman", "bandit", "guard", "veteran-knight"]) {
  const selectable = getSelectableActorById(actorKey);
  const adapted = adaptSelectableActorToCombatant(selectable, { team: "party", controlMode: "ai" });
  assert.equal(adapted.ok, true);
  assert.equal(adapted.combatant.actorKey, actorKey);
  assert.deepEqual(adapted.combatant.weaponProfiles, getCanonicalCombatActorDefinition(actorKey).weaponProfiles);
}

const staged = repairStagedSavedCharacterEntry(
  { id: "staged-squire", name: "Saved Retainer", source: "saved-character" },
  { id: "saved-squire", name: "Saved Retainer", publicClassName: "Squire", species: "Human" },
);
assert.equal(staged.combatActorMigrationAlias, "squire");
assert.equal(resolveCanonicalCombatActorKey(staged.autoRollCharacter).actorKey, "squire");

assert.equal(resolveCanonicalCombatActorKey({ id: "opaque", name: "Guard" }).actorKey, null, "display name is not identity authority");
const ambiguous = resolveCanonicalCombatActorKey({ actorKey: "squire", sourceActorKey: "guard", id: "ambiguous" });
assert.equal(ambiguous.ambiguous, true);
assert.equal(ambiguous.actorKey, null);
const aliased = normalizeReferenceCombatActor({ id: "town_guard", team: "enemy" });
assert.equal(aliased.normalizedActor.actorKey, "guard");
assert.ok(aliased.diagnostics.some((event) => event.eventType === "combat-actor-migration-alias-used"));

const duplicateA = runtime("guard", "party", "duplicate-guard-a");
const duplicateB = runtime("guard", "enemy", "duplicate-guard-b");
assert.notEqual(duplicateA.id, duplicateB.id);
assert.equal(duplicateA.actorKey, duplicateB.actorKey);
assert.equal(getCombatIconAppearance({ fighter: duplicateA }).allegiance.key, "party");
assert.equal(getCombatIconAppearance({ fighter: duplicateB }).allegiance.key, "enemy");
assert.equal(getCombatIconAppearance({ fighter: { ...duplicateA, alignment: "chaotic-evil" } }).allegiance.key, "party", "alignment cannot change allegiance color");
const activeAppearance = getCombatIconAppearance({ fighter: duplicateA, activeFighterId: duplicateA.id });
assert.equal(activeAppearance.active, true);
assert.ok(activeAppearance.rings.some((ring) => ring.key === "active"));

const selectedUnsupported = normalizeReferenceCombatActor({
  ...getCanonicalCombatActorDefinition("squire"), id: "unsupported-squire", team: "party",
  selectedCanonicalLoadout: [{ name: "Moon Blade", type: "weapon" }],
});
assert.deepEqual(selectedUnsupported.normalizedActor.weaponProfiles, getCanonicalCombatActorDefinition("squire").weaponProfiles);
assert.deepEqual(selectedUnsupported.normalizedActor.migrationMetadata.combatActor.unsupportedWeaponsReplaced, ["Moon Blade"]);
assert.ok(selectedUnsupported.diagnostics.some((event) => event.eventType === "combat-actor-safe-loadout-substituted"));

const live = normalizeReferenceCombatActor({
  ...getCanonicalCombatActorDefinition("spearman"), id: "live-spearman", team: "party", position: { x: 7, y: 3 }, hex: { x: 7, y: 3 },
  currentHP: 6, currentStamina: 5, combatStamina: { current: 5, maximum: 24 },
  grappleState: { state: "grapple_ground", opponent: "enemy-live" }, surrenderState: { status: "offered" }, statusEffects: ["shaken"],
}).normalizedActor;
assert.deepEqual(live.position, { x: 7, y: 3 });
assert.equal(live.currentHP, 6);
assert.equal(live.currentStamina, 5);
assert.equal(live.grappleState.opponent, "enemy-live");
assert.equal(live.surrenderState.status, "offered");
assert.deepEqual(live.statusEffects, ["shaken"]);
const twice = normalizeReferenceCombatActor(live).normalizedActor;
assert.deepEqual(twice.weaponProfiles, live.weaponProfiles);
assert.deepEqual(twice.position, live.position);
assert.equal(twice.currentHP, live.currentHP);
assert.equal(twice.currentStamina, live.currentStamina);

const ownedActor = { ...live, actionToken: "owned:action:1" };
const blocked = normalizeReferenceCombatActor(ownedActor, { lifecyclePhase: "attack-resolution" });
assert.equal(blocked.blocked, true);
assert.equal(blocked.normalizedActor, ownedActor);
assert.equal(blocked.diagnostics[0].eventType, "combat-actor-normalization-during-owned-action-blocked");

console.log(`Phase 3C1A canonical actor and entry-path tests passed (${ACTOR_KEYS.length} actors)`);
