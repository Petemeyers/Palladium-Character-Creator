import assert from "node:assert/strict";
import { animals } from "../src/data/animals.js";
import { CANONICAL_GROUND_ANIMAL_KEYS, getCanonicalCombatActorDefinition } from "../src/data/canonicalCombatActors.js";
import { PUBLIC_ENEMIES } from "../src/data/publicEnemies.js";
import { getSelectableActorById } from "../src/data/selectableActors.js";
import { adaptPublicEnemyToCombatant } from "../src/utils/publicEnemyCombatAdapter.js";
import { adaptSelectableActorToCombatant } from "../src/utils/selectableActorAdapter.js";
import { loadSavedPreset, savePreset } from "../src/utils/savedPresets.js";
import { normalizeReferenceCombatActor, resolveCanonicalCombatActorKey } from "../src/utils/combat/normalizeCombatActorSchema.js";
import { validateCombatActor } from "../src/utils/combat/validateCombatActor.js";

let assertions = 0;
const check = (value, message) => { assert.ok(value, message); assertions += 1; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); assertions += 1; };
const deepEqual = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions += 1; };

equal(CANONICAL_GROUND_ANIMAL_KEYS.length, 7, "only actual audited ground-animal bodies migrated");
for (const actorKey of CANONICAL_GROUND_ANIMAL_KEYS) {
  const definition = getCanonicalCombatActorDefinition(actorKey);
  check(definition, `${actorKey} definition exists`);
  equal(definition.actorKey, actorKey, `${actorKey} stable identity`);
  equal(definition.combatActorSchemaVersion, 1, `${actorKey} schema version`);
  equal(definition.creatureType, "animal", `${actorKey} neutral creature type`);
  check(definition.species && definition.species !== "animal", `${actorKey} explicit species`);
  equal(definition.anatomyProfile.bodyPlan, "quadruped", `${actorKey} anatomy`);
  equal(definition.movement.canFly, false, `${actorKey} ground only`);
  equal(definition.inventory.length, 0, `${actorKey} no manufactured inventory`);
  equal(definition.heldItems.mainHand, null, `${actorKey} no held weapon`);
  equal(definition.surrenderProfile.opensHumanoidDecisionPanel, false, `${actorKey} no humanoid surrender UI`);
  equal(definition.alignment, null, `${actorKey} species does not imply morality`);
  const validation = validateCombatActor({ ...definition, id: `test:${actorKey}`, team: "enemy", side: "enemy", battleSide: "enemy" });
  equal(validation.valid, true, `${actorKey}: ${JSON.stringify(validation.errors)}`);
  equal(validation.warnings.length, 0, `${actorKey}: ${JSON.stringify(validation.warnings)}`);
}

for (const actorKey of ["wolf", "boar"]) {
  const selectable = getSelectableActorById(actorKey);
  const result = adaptSelectableActorToCombatant(selectable);
  equal(result.ok, true);
  equal(result.combatant.actorKey, actorKey);
  deepEqual(result.combatant.naturalAttackProfiles, getCanonicalCombatActorDefinition(actorKey).naturalAttackProfiles);
}
for (const actorKey of ["wolf", "brown-bear", "giant-rat"]) {
  const publicEnemy = PUBLIC_ENEMIES.find((actor) => actor.id === actorKey);
  const result = adaptPublicEnemyToCombatant(publicEnemy);
  equal(result.ok, true);
  equal(result.combatant.actorKey, actorKey);
  deepEqual(result.combatant.naturalAttackProfiles, getCanonicalCombatActorDefinition(actorKey).naturalAttackProfiles);
}
for (const actorKey of ["warhorse", "mastiff", "wolf", "boar", "bear"]) {
  const compatibility = animals.find((actor) => actor.id === actorKey);
  equal(compatibility.actorKey, actorKey);
  equal(compatibility.compatibilityId, actorKey);
  deepEqual(compatibility.naturalAttackProfiles, getCanonicalCombatActorDefinition(actorKey).naturalAttackProfiles);
}

const stored = new Map();
const storage = {
  getItem: (key) => stored.has(key) ? stored.get(key) : null,
  setItem: (key, value) => stored.set(key, String(value)),
  removeItem: (key) => stored.delete(key),
};
const savedFighters = CANONICAL_GROUND_ANIMAL_KEYS.map((actorKey, index) => ({
  ...getCanonicalCombatActorDefinition(actorKey),
  id: `saved:${actorKey}`,
  team: "enemy",
  side: "enemy",
  position: { x: index, y: 1 },
}));
const presetId = savePreset({ name: "Phase 3C2A animals", fighters: savedFighters, positions: {} }, { storage });
const loadedPreset = loadSavedPreset(presetId, { storage });
equal(loadedPreset.fighters.length, CANONICAL_GROUND_ANIMAL_KEYS.length, "saved path retains every migrated animal");
for (const fighter of loadedPreset.fighters) {
  deepEqual(fighter.naturalAttackProfiles, getCanonicalCombatActorDefinition(fighter.actorKey).naturalAttackProfiles, `${fighter.actorKey} saved natural profiles`);
  equal(fighter.species, getCanonicalCombatActorDefinition(fighter.actorKey).species, `${fighter.actorKey} saved species`);
}

equal(resolveCanonicalCombatActorKey({ id: "opaque-animal", name: "Wolf", creatureType: "animal" }).actorKey, null, "display name is not identity");
equal(resolveCanonicalCombatActorKey({ actorKey: "wolf", sourceActorKey: "boar" }).ambiguous, true, "conflicting animal identities are ambiguous");
const alias = normalizeReferenceCombatActor({ id: "giant_rat", team: "enemy", category: "animal" });
equal(alias.normalizedActor.actorKey, "giant-rat");
check(alias.diagnostics.some((entry) => entry.eventType === "animal-migration-alias-used"), "animal alias diagnostic");
const missing = normalizeReferenceCombatActor({ id: "unknown-quadruped", name: "Wolf", creatureType: "animal" });
check(missing.diagnostics.some((entry) => entry.eventType === "animal-canonical-identity-missing"), "unknown animal compatibility warning");

const live = normalizeReferenceCombatActor({
  ...getCanonicalCombatActorDefinition("wolf"),
  id: "live:wolf",
  team: "party",
  side: "party",
  position: { x: 6, y: 4 },
  currentHP: 5,
  currentStamina: 3,
  combatStamina: { authority: "canonical", maximum: 12, current: 3 },
  grappleState: { state: "grapple_ground", opponent: "enemy:guard" },
  moraleState: { status: "shaken" },
  survivalState: { status: "hold-position" },
  currentTarget: { id: "enemy:guard" },
  statusEffects: ["fallen"],
  injuryState: { leg: "minor" },
}).normalizedActor;
equal(live.currentHP, 5);
equal(live.currentStamina, 3);
deepEqual(live.position, { x: 6, y: 4 });
equal(live.grappleState.opponent, "enemy:guard");
equal(live.moraleState.status, "shaken");
equal(live.survivalState.status, "hold-position");
equal(live.currentTarget.id, "enemy:guard");
deepEqual(live.statusEffects, ["fallen"]);
deepEqual(live.injuryState, { leg: "minor" });
const twice = normalizeReferenceCombatActor(live).normalizedActor;
deepEqual(twice.naturalAttackProfiles, live.naturalAttackProfiles, "normalization idempotent");
deepEqual(twice.position, live.position);
equal(twice.currentHP, live.currentHP);
equal(twice.currentStamina, live.currentStamina);
for (const phase of ["attack-resolution", "damage-application", "movement-commit", "grapple-resolution", "continuation-admission", "survival-action-commit", "turn-handoff"]) {
  const blocked = normalizeReferenceCombatActor(live, { lifecyclePhase: phase });
  equal(blocked.blocked, true, `${phase} normalization blocked`);
}

console.log(`Phase 3C2A ground-animal schema tests passed: ${assertions}`);
