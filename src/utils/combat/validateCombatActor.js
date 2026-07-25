import { getCanonicalCombatActorDefinition } from "../../data/canonicalCombatActors.js";
import { hasAlignmentBehaviorMapping } from "../behavior/normalizeAlignmentBehavior.js";
import { normalizeReferenceCombatActor, resolveCanonicalCombatActorKey } from "./normalizeCombatActorSchema.js";
import { getNaturalAttackAnatomyRejection, isCanonicalNaturalAttack, NATURAL_ATTACK_MANUFACTURED_FIELDS } from "./canonicalNaturalAttacks.js";
import { FLIGHT_MODES, getAltitudeBand, getCanonicalAltitude } from "./canonicalFlightState.js";

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
  const canonicalAnimal = text(normalizedActor.creatureType) === "animal";
  const canonicalFlyer = canonicalAnimal && normalizedActor.flightProfile?.kind === "biological";
  compatibilityFallbacks.push(...normalizedResult.compatibilityFallbacks);
  const pushError = (code, message, eventType = "combat-actor-validation-failed") => errors.push({ code, message, eventType });
  const pushWarning = (code, message, eventType = "combat-actor-validation-warning") => warnings.push({ code, message, eventType });

  if (!normalizedActor.id || !normalizedActor.name) pushError("missing-authoritative-identity", "Stable id and name are required.", "combat-actor-identity-contradiction");
  if (!normalizedActor.actorKey) {
    compatibilityFallbacks.push("unmigrated-actor-schema");
    pushWarning("unmigrated-actor-schema", "Actor has not yet migrated to combatActorSchemaVersion 1.");
  }
  if (Number(normalizedActor.combatActorSchemaVersion) === 1 && text(normalizedActor.creatureType) === "humanoid" && !normalizedActor.actorKey) {
    pushError("migrated-humanoid-missing-actor-key", "Schema-version-one humanoid requires a canonical actorKey.", "combat-actor-identity-contradiction");
  }
  if (Number(normalizedActor.combatActorSchemaVersion) === 1 && canonicalAnimal && !normalizedActor.actorKey) pushError("animal-missing-actor-key", "Schema-version-one animal requires a canonical actorKey.", "animal-canonical-identity-missing");
  if (canonicalAnimal && !normalizedActor.species) pushError("animal-missing-species", "Canonical animal requires an explicit species.", "animal-canonical-identity-missing");
  if (canonicalAnimal && !normalizedActor.anatomyProfile) pushError("animal-missing-anatomy-profile", "Canonical animal requires an anatomy profile.", "animal-anatomy-invalid");
  if (canonicalAnimal && normalizedActor.movement?.canFly === true && !canonicalFlyer) pushError("ground-animal-flying-movement", "Phase 3C2A ground animals cannot carry flying movement.", "animal-movement-invalid");
  if (canonicalAnimal && normalizedActor.movement?.canFly === true && !normalizedActor.flightProfile) pushError("flying-animal-missing-flight-profile", "Flying movement requires a canonical flight profile.", "invalid-flight-state");
  if (canonicalFlyer && normalizedActor.anatomyProfile?.wingsPresent !== true) pushError("flying-animal-missing-wing-anatomy", "Biological flight requires explicit wings.", "invalid-flight-state");
  if (canonicalFlyer) {
    const flightState = normalizedActor.flightState || {};
    const altitude = getCanonicalAltitude(normalizedActor);
    const mode = text(flightState.mode);
    if (!FLIGHT_MODES.includes(mode)) pushError("unsupported-flight-mode", `Unsupported flight mode ${flightState.mode}.`, "invalid-flight-state");
    if (!Number.isFinite(Number(flightState.altitudeFeet))) pushError("non-finite-altitude", "Canonical altitude must be finite.", "invalid-flight-state");
    if (Number(flightState.altitudeFeet) < 0) pushError("negative-altitude", "Canonical altitude cannot be negative.", "negative-altitude");
    if (["grounded", "perched"].includes(mode) && altitude !== 0) pushError("grounded-positive-altitude", "Grounded or perched flight state requires altitude zero.", "invalid-flight-state");
    if (["airborne", "descending", "falling"].includes(mode) && altitude <= 0) pushError("airborne-zero-altitude", "Airborne flight state requires positive altitude.", "invalid-flight-state");
    if (flightState.altitudeBand !== getAltitudeBand(altitude)) pushError("unsupported-altitude-band", "Altitude band does not match exact altitude.", "invalid-flight-state");
    if (mode === "falling" && Number(flightState.verticalVelocity) > 0) pushError("falling-upward-velocity", "Falling cannot carry upward vertical velocity.", "invalid-flight-state");
    const legacyValues = [normalizedActor.isFlying, normalizedActor.flying, normalizedActor.airborne, normalizedActor.inFlight, normalizedActor.hovering]
      .filter((value) => typeof value === "boolean");
    if (normalizedActor.flightCompatibilityProjection !== true && legacyValues.some((value) => value !== (altitude > 0))) {
      pushError("conflicting-flight-booleans", "Legacy flight booleans conflict with canonical flight state.", "invalid-flight-state");
    }
    if (normalizedActor.flightProfile?.mountedFlight === true || normalizedActor.flightProfile?.magicalFlight === true) {
      pushError("unsupported-flight-source", "Phase 3C2B supports only ordinary biological flight.", "invalid-flight-state");
    }
  }
  if (canonicalAnimal && (normalizedActor.rider || normalizedActor.riderId || normalizedActor.mounted || normalizedActor.barding || normalizedActor.armorProfile?.barding === true)) pushError("ground-animal-mounted-state", "Phase 3C2A animals cannot carry rider, mounted, or barding state.", "animal-mounted-state-invalid");
  if (canonicalAnimal && (normalizedActor.heldItems?.mainHand || normalizedActor.heldItems?.offHand)) pushError("animal-holding-manufactured-weapon", "Ordinary animals cannot hold manufactured weapons.", "natural-attack-manufactured-metadata");
  if (canonicalAnimal && (normalizedActor.ammunitionState || (normalizedActor.ammunition || []).length)) pushError("animal-carrying-ammunition", "Ordinary animals cannot carry ammunition.", "natural-attack-manufactured-metadata");
  if (canonicalAnimal && normalizedActor.surrenderProfile?.opensHumanoidDecisionPanel === true) pushError("animal-using-humanoid-surrender-panel", "Ordinary animals cannot open the humanoid surrender panel.", "animal-invalid-humanoid-surrender-blocked");
  if (canonicalAnimal && normalizedActor.alignment) pushError("animal-species-moral-alignment", "Ordinary animal behavior cannot be derived from moral alignment.", "animal-alignment-authority-invalid");
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

  const inventory = normalizedActor.inventory || [];
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
    const deliveryType = text(profile.deliveryType);
    if (isCanonicalNaturalAttack(profile)) {
      if (canonicalAnimal) {
        const manufacturedFields = NATURAL_ATTACK_MANUFACTURED_FIELDS.filter((field) => profile[field] !== undefined && profile[field] !== null && profile[field] !== false && profile[field] !== 0 && profile[field] !== "none");
        if (profile.manufacturedWeapon === true || manufacturedFields.length) pushError("natural-manufactured-metadata", `${profile.name} inherits manufactured weapon metadata: ${manufacturedFields.join(", ") || "manufacturedWeapon"}.`, "natural-attack-manufactured-metadata");
        const anatomyReason = getNaturalAttackAnatomyRejection(normalizedActor, profile);
        if (anatomyReason) pushError("natural-attack-invalid-anatomy", `${profile.name} is unavailable: ${anatomyReason}.`, "animal-anatomy-invalid");
        if (!profile.anatomySource) pushError("natural-attack-missing-anatomy-source", `${profile.name} lacks anatomySource.`, "animal-anatomy-invalid");
        if (deliveryType === "projectile" || text(profile.resolverRoute).includes("projectile")) pushError("natural-attack-projectile-routing", `${profile.name} cannot use projectile routing.`, "natural-attack-manufactured-metadata");
        if (text(profile.naturalWeaponType) === "pounce" && !(profile.prerequisites || []).length) pushError("pounce-missing-prerequisite", `${profile.name} requires an explicit prerequisite.`, "animal-anatomy-invalid");
        if (profile.swoopProfile && !(profile.swoopProfile.minimumAltitudeFeet > 0)) pushError("swoop-missing-prerequisite", `${profile.name} lacks a valid swoop altitude prerequisite.`, "animal-anatomy-invalid");
      } else if (profile.sourceWeaponId || profile.sourceWeaponName || profile.manufacturedWeapon === true) {
        pushError("natural-manufactured-metadata", `${profile.name} inherits manufactured weapon metadata.`, "combat-actor-weapon-profile-contradiction");
      }
    }
    const normalRange = Number(profile.normalRangeFeet ?? profile.rangeProfile?.normal);
    const longRange = Number(profile.longRangeFeet ?? profile.rangeProfile?.long);
    const minimumReach = Number(profile.minimumEffectiveReachFeet);
    const maximumReach = Number(profile.reachFeet ?? profile.reach);
    if (deliveryType === "projectile" && !profile.ammunitionType) pushError("projectile-missing-ammunition-type", `${profile.name} has no canonical ammunition type.`, "combat-actor-weapon-profile-contradiction");
    if (deliveryType === "projectile" && !profile.armorContactProfile) pushError("projectile-missing-armor-contact-profile", `${profile.name} has no armor-contact profile.`, "combat-actor-weapon-profile-contradiction");
    if (deliveryType === "projectile" && text(profile.kind || profile.attackType) === "melee") pushError("projectile-routed-as-melee", `${profile.name} is routed as melee.`, "combat-actor-weapon-profile-contradiction");
    if (deliveryType === "extended-melee" && (profile.ammunitionType || profile.ammunition)) pushError("polearm-consuming-ammunition", `${profile.name} cannot consume projectile ammunition.`, "combat-actor-weapon-profile-contradiction");
    if (deliveryType === "extended-melee" && text(profile.kind || profile.attackType) === "ranged") pushError("extended-melee-routed-as-projectile", `${profile.name} is routed as projectile.`, "combat-actor-weapon-profile-contradiction");
    if (deliveryType === "projectile" && (!Number.isFinite(normalRange) || !Number.isFinite(longRange) || normalRange <= 0 || longRange <= 0 || normalRange > longRange)) pushError("invalid-projectile-range", `${profile.name} has contradictory range values.`, "combat-actor-weapon-profile-contradiction");
    if (deliveryType === "extended-melee" && Number.isFinite(minimumReach) && Number.isFinite(maximumReach) && minimumReach > maximumReach) pushError("invalid-extended-melee-reach", `${profile.name} has minimum reach beyond maximum reach.`, "combat-actor-weapon-profile-contradiction");
    if (text(profile.weaponFamily) === "bow" || text(profile.weaponFamily) === "longbow") {
      if (text(profile.reloadRequirement) !== "none") pushError("bow-inherits-crossbow-reload", `${profile.name} cannot use crossbow reload behavior.`, "combat-actor-weapon-profile-contradiction");
    }
    if (text(profile.weaponFamily) === "crossbow" && text(profile.drawRequirement) === "part-of-attack") pushError("crossbow-inherits-bow-draw", `${profile.name} cannot use bow draw behavior.`, "combat-actor-weapon-profile-contradiction");
    const matchingAttack = attacks.find((attack) => idOf(attack) === idOf(profile));
    if (matchingAttack && (matchingAttack.damage !== profile.damage || text(matchingAttack.damageType) !== text(profile.damageType))) pushError("attack-profile-damage-contradiction", `${profile.name} attack/profile damage identity differs.`, "combat-actor-weapon-profile-contradiction");
  });
  const ammunitionState = normalizedActor.ammunitionState;
  if (ammunitionState) {
    const current = Number(ammunitionState.current);
    const maximum = Number(ammunitionState.maximum);
    const ammoWeapon = profiles.find((profile) => idOf(profile) === ammunitionState.weaponId);
    if (!ammoWeapon || text(ammoWeapon.deliveryType) !== "projectile") pushError("ammunition-without-compatible-weapon", "Canonical ammunition has no compatible projectile weapon.", "combat-actor-weapon-profile-contradiction");
    if (!Number.isFinite(current) || current < 0) pushError("negative-ammunition", "Ammunition cannot be negative.", "combat-actor-weapon-profile-contradiction");
    if (!Number.isFinite(maximum) || current > maximum) pushError("ammunition-above-maximum", "Ammunition exceeds canonical maximum.", "combat-actor-weapon-profile-contradiction");
    if (text(ammoWeapon?.weaponFamily) === "crossbow" && ammunitionState.reloadState === "loaded" && !ammunitionState.chambered) pushError("loaded-crossbow-without-chambered-bolt", "Loaded crossbow requires a chambered bolt.", "combat-actor-weapon-profile-contradiction");
    if (ammunitionState.chambered && ammunitionState.reloadState !== "loaded") pushError("chambered-ammunition-with-unloaded-state", "Chambered ammunition contradicts reload state.", "combat-actor-weapon-profile-contradiction");
  }
  if (normalizedActor.rangedTacticalProfile && !profiles.some((profile) => text(profile.deliveryType) === "projectile" || text(profile.deliveryType) === "thrown")) {
    pushError("ranged-ai-without-usable-ranged-weapon", "Ranged tactical profile has no ranged weapon.", "combat-actor-weapon-profile-contradiction");
  }
  const activeShield = normalizedActor.equippedShield && normalizedActor.equippedShield.active !== false;
  const activeTwoHandedWeapon = profiles.find((profile) => (
    idOf(profile) === mainHand &&
    (profile.twoHanded || profile.requiresTwoHands || Number(profile.handsRequired) === 2)
  ));
  if (activeShield && activeTwoHandedWeapon) pushError("two-handed-weapon-with-active-shield", `${activeTwoHandedWeapon.name} cannot be ready with an active shield.`, "combat-actor-weapon-profile-contradiction");
  const loadout = normalizedActor.loadouts?.[normalizedActor.loadoutKey || normalizedActor.defaultLoadoutKey];
  if (normalizedActor.loadoutKey && !loadout) pushError("loadout-key-missing", `Loadout ${normalizedActor.loadoutKey} has no canonical definition.`, "combat-actor-weapon-profile-contradiction");
  for (const profileKey of loadout?.weaponProfileKeys || []) {
    if (!profiles.some((profile) => idOf(profile) === profileKey)) pushError("loadout-reference-missing-item", `Loadout references unavailable weapon ${profileKey}.`, "combat-actor-weapon-profile-contradiction");
  }
  const sidearmId = normalizedActor.heldItems?.sidearm;
  if (sidearmId && !inventory.some((item) => idOf(item) === sidearmId)) pushError("sidearm-without-inventory-source", `Sidearm ${sidearmId} is not present in inventory.`, "combat-actor-weapon-profile-contradiction");
  const clinchId = normalizedActor.combatWeaponState?.clinchWeaponId;
  if (clinchId && !profiles.some((profile) => idOf(profile) === clinchId && profile.usableInClinch === true)) pushError("invalid-clinch-weapon", "Clinch-ready weapon lacks clinch compatibility.", "combat-actor-weapon-profile-contradiction");
  const retainedId = normalizedActor.combatWeaponState?.retainedWeaponId;
  if (retainedId && !inventory.some((item) => idOf(item) === retainedId) && !profiles.some((item) => idOf(item) === retainedId)) pushError("retained-weapon-unavailable", "Retained weapon is unavailable for grapple cleanup.", "combat-actor-weapon-profile-contradiction");
  if (normalizedActor.equippedArmor && Object.keys(normalizedActor.equippedArmor).length > 0 && (!normalizedActor.armorProfile || Object.keys(normalizedActor.armorProfile).length === 0)) pushError("missing-armor-profile", "Equipped armor has no armor profile.");
  if (!canonicalAnimal && normalizedActor.armorProfile && Object.keys(normalizedActor.armorProfile).length > 0 && (!normalizedActor.equippedArmor || Object.keys(normalizedActor.equippedArmor).length === 0)) pushWarning("armor-profile-without-equipped-armor", "Armor profile exists without an equipped armor item.");
  const equipment = Array.isArray(normalizedActor.equipment) ? normalizedActor.equipment : [];
  const armorItems = equipment.filter((item) => text(item.type) === "armor");
  if (armorItems.length && !normalizedActor.armorProfile?.profileKey) pushError("armor-item-without-armor-profile", "Equipped armor item has no canonical armor profile.");
  if (armorItems.length && normalizedActor.armorProfile?.profileKey && !armorItems.some((item) => idOf(item) === normalizedActor.armorProfile.profileKey)) pushError("armor-equipment-profile-identity-contradiction", "Armor equipment does not contain the canonical armor-profile item.");
  const shieldItems = equipment.filter((item) => text(item.type) === "shield");
  const equippedShieldId = idOf(normalizedActor.equippedShield || {});
  const heldOffHandId = normalizedActor.heldItems?.offHand;
  if (shieldItems.length && !shieldItems.some((item) => idOf(item) === equippedShieldId || idOf(item) === heldOffHandId)) pushWarning("shield-listed-but-not-held-equipped", "Shield is listed but neither held nor equipped.");
  if (normalizedActor.equippedArmor?.profileKey && normalizedActor.armorProfile?.profileKey && normalizedActor.equippedArmor.profileKey !== normalizedActor.armorProfile.profileKey) pushError("armor-profile-identity-contradiction", "Equipped armor and armor profile identities differ.");
  const armorGuard = Number(normalizedActor.equippedArmor?.guardRating);
  const derivedArmorClass = Number(normalizedActor.derivedStats?.armorClass);
  if (Number.isFinite(armorGuard) && Number.isFinite(derivedArmorClass) && armorGuard !== derivedArmorClass) pushError("armor-rating-contradiction", "Equipped armor rating disagrees with derived armor class.");
  if (text(normalizedActor.armorProfile?.armorClass) === "plate" && !/plate|heavy/.test(text(normalizedActor.equippedArmor?.armorClass || normalizedActor.equippedArmor?.category || normalizedActor.equippedArmor?.name))) pushError("plate-coverage-worn-layer-contradiction", "Plate armor profile contradicts the equipped armor layer.");
  const durabilityValues = values(normalizedActor.equippedArmor?.armorDurability, normalizedActor.equippedArmor?.durability, normalizedActor.armorProfile?.armorDurability, normalizedActor.armorProfile?.durability);
  if (durabilityValues.some((value) => value < 0)) pushError("negative-armor-durability", "Armor durability cannot be negative.");
  if (new Set(durabilityValues).size > 1) pushWarning("duplicate-armor-durability-authority", "Armor durability authorities disagree.");
  if (!canonicalAnimal && !hasAlignmentBehaviorMapping(normalizedActor.alignment)) pushWarning("alignment-mapping-missing", `No behavior mapping for ${normalizedActor.alignment || "empty alignment"}.`, "combat-actor-alignment-mapping-missing");
  if (normalizedActor.surrenderProfile?.mayOfferSurrender && !normalizedActor.surrenderProfile?.behaviorProfile) pushWarning("missing-surrender-profile", "Surrender-capable actor lacks behavior profile.");
  if (canonical && !normalizedActor.surrenderProfile) pushError("surrender-capable-actor-missing-surrender-profile", "Canonical actor lacks a surrender profile.");
  if (canonical && !normalizedActor.grappleProfile) pushError("grapple-profile-absent", "Canonical actor lacks a grapple profile.");
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
    for (const field of ["armorProfile", "heldItems", "grappleProfile", "surrenderProfile", "alignment", "anatomyProfile", "naturalAttackProfiles"]) {
      if (JSON.stringify(other[field]) !== JSON.stringify(normalizedActor[field])) pushError("public-compatibility-schema-divergence", `Public and compatibility ${field} differ.`, "combat-actor-identity-contradiction");
    }
  }
  const diagnostics = [
    ...(normalizedResult.diagnostics || []).filter((entry) => entry.eventType === "combat-actor-unsupported-weapon-replaced"),
    ...errors.map((entry) => ({ eventType: entry.eventType, level: "error", actorId: normalizedActor.id, data: entry })),
    ...warnings.map((entry) => ({ eventType: entry.eventType, level: "warning", actorId: normalizedActor.id, data: entry })),
    ...compatibilityFallbacks.map((fallback) => ({ eventType: "combat-actor-compatibility-fallback-used", level: "warning", actorId: normalizedActor.id, data: { fallback } })),
    ...(canonicalAnimal ? [{ eventType: "animal-anatomy-validated", level: "info", actorId: normalizedActor.id, data: { actorKey: normalizedActor.actorKey, bodyPlan: normalizedActor.anatomyProfile?.bodyPlan } }] : []),
    { eventType: "combat-actor-schema-normalized", level: "info", actorId: normalizedActor.id, data: { actorKey: normalizedActor.actorKey, schemaVersion: normalizedActor.combatActorSchemaVersion } },
  ];
  diagnostics.forEach((entry) => emitDiagnostic?.(entry));
  return { valid: errors.length === 0, errors, warnings, compatibilityFallbacks, normalizedActor, diagnostics, blocksCombatStart: errors.some((entry) => /identity|weapon|damage|side|hp/.test(entry.code)) };
}

export default validateCombatActor;
