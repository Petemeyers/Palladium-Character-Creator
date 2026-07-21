import { getCanonicalCombatActorDefinition } from "../../data/canonicalCombatActors.js";
import { hasAlignmentBehaviorMapping } from "../behavior/normalizeAlignmentBehavior.js";
import { normalizeReferenceCombatActor, resolveCanonicalCombatActorKey } from "./normalizeCombatActorSchema.js";

const text = (value) => String(value || "").trim().toLowerCase();
const idOf = (item = {}) => item.profileKey || item.weaponId || item.id || item.name || null;
const values = (...entries) => entries.map(Number).filter(Number.isFinite);
const SIZE_PROFILES = new Set(["tiny", "small", "medium", "large", "huge", "gargantuan"]);

export function validateCombatActor(actor = {}, { comparisonActor = null, emitDiagnostic = null, normalize = true } = {}) {
  const errors = [];
  const warnings = [];
  const compatibilityFallbacks = [];
  const resolution = resolveCanonicalCombatActorKey(actor);
  const canonical = resolution.actorKey ? getCanonicalCombatActorDefinition(resolution.actorKey) : null;
  const normalizedResult = normalize ? normalizeReferenceCombatActor(actor, { source: "validator" }) : { normalizedActor: actor, compatibilityFallbacks: [] };
  const normalizedActor = normalizedResult.normalizedActor;
  const identityActor = canonical ? actor : normalizedActor;
  compatibilityFallbacks.push(...normalizedResult.compatibilityFallbacks);
  const pushError = (code, message, eventType = "combat-actor-validation-failed") => errors.push({ code, message, eventType });
  const pushWarning = (code, message, eventType = "combat-actor-validation-warning") => warnings.push({ code, message, eventType });

  if (!normalizedActor.id || !normalizedActor.name) pushError("missing-authoritative-identity", "Stable id and name are required.", "combat-actor-identity-contradiction");
  if (!normalizedActor.actorKey) {
    compatibilityFallbacks.push("unmigrated-actor-schema");
    pushWarning("unmigrated-actor-schema", "Actor has not yet migrated to combatActorSchemaVersion 1.");
  }
  if (canonical && actor.species && text(actor.species) !== text(canonical.species)) pushError("species-identity-contradiction", `${actor.species} contradicts ${canonical.species}.`, "combat-actor-identity-contradiction");
  if (canonical && actor.creatureType && text(actor.creatureType) !== text(canonical.creatureType)) pushError("creature-type-identity-contradiction", `${actor.creatureType} contradicts ${canonical.creatureType}.`, "combat-actor-identity-contradiction");
  if (canonical && Array.isArray(actor.tags)) {
    const contradictorySpeciesTag = ["human", "goblin", "minotaur"].find((tag) => tag !== text(canonical.species) && actor.tags.some((value) => text(value) === tag));
    if (contradictorySpeciesTag) pushError("species-tag-identity-contradiction", `${contradictorySpeciesTag} tag contradicts ${canonical.species}.`, "combat-actor-identity-contradiction");
  }
  if (canonical && (!SIZE_PROFILES.has(text(normalizedActor.size)) || text(normalizedActor.grappleProfile?.sizeProfile) !== text(normalizedActor.size))) pushError("missing-size-grapple-profile", "Size has no matching grapple profile.");
  if (canonical && !normalizedActor.team && !normalizedActor.side && !normalizedActor.battleSide) pushError("missing-side-identity", "Combat side identity is required.", "combat-actor-identity-contradiction");
  if (actor.team && actor.side && text(actor.team) !== text(actor.side)) pushError("side-identity-contradiction", "Team and side identity disagree.", "combat-actor-identity-contradiction");
  if (actor.team && actor.battleSide && text(actor.team) !== text(actor.battleSide)) pushError("battle-side-identity-contradiction", "Team and battle-side identity disagree.", "combat-actor-identity-contradiction");

  const inventory = Array.isArray(identityActor.inventory) ? identityActor.inventory : (normalizedActor.inventory || []);
  const attacks = Array.isArray(identityActor.attacks) ? identityActor.attacks : (normalizedActor.attacks || []);
  const profiles = Array.isArray(identityActor.weaponProfiles) ? identityActor.weaponProfiles : (normalizedActor.weaponProfiles || attacks);
  const profileIds = new Set(profiles.map(idOf).filter(Boolean));
  inventory.filter((item) => text(item.type).includes("weapon") || item.damage).forEach((item) => {
    if (!profileIds.has(idOf(item))) pushWarning("inventory-weapon-without-profile", `${item.name || idOf(item)} has no usable attack profile.`, "combat-actor-weapon-profile-contradiction");
  });
  const mainHand = identityActor.heldItems?.mainHand ?? normalizedActor.heldItems?.mainHand;
  const readyWeapon = identityActor.combatWeaponState?.readyWeaponId ?? normalizedActor.combatWeaponState?.readyWeaponId;
  if (mainHand && readyWeapon && mainHand !== readyWeapon && !(identityActor.combatWeaponState || normalizedActor.combatWeaponState)?.lastTransitionReason) pushError("held-ready-weapon-contradiction", "Held and ready weapon differ without a transition reason.", "combat-actor-weapon-profile-contradiction");
  profiles.forEach((profile) => {
    if ((profile.twoHanded || profile.requiresTwoHands || Number(profile.handsRequired) === 2) && text(profile.handedness || profile.category) === "one-handed") pushError("two-handed-marked-one-handed", `${profile.name} has contradictory handedness.`, "combat-actor-weapon-profile-contradiction");
    if (profile.isNaturalAttack || profile.naturalWeapon) {
      if (profile.sourceWeaponId || profile.sourceWeaponName || profile.manufacturedWeapon === true) pushError("natural-manufactured-metadata", `${profile.name} inherits manufactured weapon metadata.`, "combat-actor-weapon-profile-contradiction");
    }
    const matchingAttack = attacks.find((attack) => idOf(attack) === idOf(profile));
    if (matchingAttack && (matchingAttack.damage !== profile.damage || text(matchingAttack.damageType) !== text(profile.damageType))) pushError("attack-profile-damage-contradiction", `${profile.name} attack/profile damage identity differs.`, "combat-actor-weapon-profile-contradiction");
  });
  const clinchId = normalizedActor.combatWeaponState?.clinchWeaponId;
  if (clinchId && !profiles.some((profile) => idOf(profile) === clinchId && profile.usableInClinch === true)) pushError("invalid-clinch-weapon", "Clinch-ready weapon lacks clinch compatibility.", "combat-actor-weapon-profile-contradiction");
  const retainedId = normalizedActor.combatWeaponState?.retainedWeaponId;
  if (retainedId && !inventory.some((item) => idOf(item) === retainedId) && !profiles.some((item) => idOf(item) === retainedId)) pushError("retained-weapon-unavailable", "Retained weapon is unavailable for grapple cleanup.", "combat-actor-weapon-profile-contradiction");
  if (normalizedActor.equippedArmor && Object.keys(normalizedActor.equippedArmor).length > 0 && (!normalizedActor.armorProfile || Object.keys(normalizedActor.armorProfile).length === 0)) pushError("missing-armor-profile", "Equipped armor has no armor profile.");
  if (normalizedActor.equippedArmor?.profileKey && normalizedActor.armorProfile?.profileKey && normalizedActor.equippedArmor.profileKey !== normalizedActor.armorProfile.profileKey) pushError("armor-profile-identity-contradiction", "Equipped armor and armor profile identities differ.");
  const armorGuard = Number(normalizedActor.equippedArmor?.guardRating);
  const derivedArmorClass = Number(normalizedActor.derivedStats?.armorClass);
  if (Number.isFinite(armorGuard) && Number.isFinite(derivedArmorClass) && armorGuard !== derivedArmorClass) pushError("armor-rating-contradiction", "Equipped armor rating disagrees with derived armor class.");
  if (!hasAlignmentBehaviorMapping(normalizedActor.alignment)) pushWarning("alignment-mapping-missing", `No behavior mapping for ${normalizedActor.alignment || "empty alignment"}.`, "combat-actor-alignment-mapping-missing");
  if (normalizedActor.surrenderProfile?.mayOfferSurrender && !normalizedActor.surrenderProfile?.behaviorProfile) pushWarning("missing-surrender-profile", "Surrender-capable actor lacks behavior profile.");
  const staminaValues = values(actor.currentStamina, actor.currentstamina, actor.stamina, actor.combatStamina?.current, actor.combatStamina?.currentStamina);
  if (new Set(staminaValues).size > 1) pushWarning("stamina-authority-contradiction", "Legacy stamina aliases disagree with combatStamina.");
  const hpValues = values(actor.currentHP, actor.currentHp, actor.hp, actor.HP);
  if (new Set(hpValues).size > 1) pushError("hp-authority-contradiction", "Current HP aliases disagree.");
  if (comparisonActor) {
    const other = normalizeReferenceCombatActor(comparisonActor, { source: "validator-comparison" }).normalizedActor;
    for (const field of ["actorKey", "species", "creatureType", "size"]) {
      if (text(other[field]) !== text(normalizedActor[field])) pushError("public-compatibility-divergence", `Public and compatibility ${field} differ.`, "combat-actor-identity-contradiction");
    }
    if (JSON.stringify(other.weaponProfiles) !== JSON.stringify(normalizedActor.weaponProfiles)) pushError("public-compatibility-weapon-divergence", "Public and compatibility weapon profiles differ.", "combat-actor-weapon-profile-contradiction");
  }
  const diagnostics = [
    ...errors.map((entry) => ({ eventType: entry.eventType, level: "error", actorId: normalizedActor.id, data: entry })),
    ...warnings.map((entry) => ({ eventType: entry.eventType, level: "warning", actorId: normalizedActor.id, data: entry })),
    ...compatibilityFallbacks.map((fallback) => ({ eventType: "combat-actor-compatibility-fallback-used", level: "warning", actorId: normalizedActor.id, data: { fallback } })),
    { eventType: "combat-actor-schema-normalized", level: "info", actorId: normalizedActor.id, data: { actorKey: normalizedActor.actorKey, schemaVersion: normalizedActor.combatActorSchemaVersion } },
  ];
  diagnostics.forEach((entry) => emitDiagnostic?.(entry));
  return { valid: errors.length === 0, errors, warnings, compatibilityFallbacks, normalizedActor, diagnostics, blocksCombatStart: errors.some((entry) => /identity|weapon|damage|side|hp/.test(entry.code)) };
}

export default validateCombatActor;
