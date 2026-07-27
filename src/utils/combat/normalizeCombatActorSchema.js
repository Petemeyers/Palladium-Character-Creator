import { getCanonicalCombatActorDefinition, getCanonicalWeaponProfileByAlias, resolveCanonicalCombatActorAlias } from "../../data/canonicalCombatActors.js";
import { normalizeAlignmentBehavior } from "../behavior/normalizeAlignmentBehavior.js";
import { normalizeCanonicalAmmunitionState } from "./canonicalRangedCombat.js";
import { normalizeCanonicalFlightState } from "./canonicalFlightState.js";

const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
const keyText = (value) => String(value || "").trim().toLowerCase();

export function resolveCanonicalCombatActorKey(actor = {}) {
  const candidates = [
    ["actorKey", actor.actorKey],
    ["canonicalActorKey", actor.canonicalActorKey],
    ["sourceActorKey", actor.sourceActorKey],
    ["combatActorMigrationAlias", actor.combatActorMigrationAlias],
    ["selectableActorId", actor.selectableActorId],
    ["pickerId", actor.pickerId],
    ["compatibilityId", actor.compatibilityId],
    ["sourceEnemyId", actor.sourceEnemyId],
    ["sourceCharacterId", actor.sourceCharacterId],
    ["modelKey", actor.modelKey],
    ["id", actor.id],
  ];
  const matches = candidates.flatMap(([identityField, candidate]) => {
    const key = keyText(candidate).replace(/^selectable-/, "");
    const resolved = resolveCanonicalCombatActorAlias(key);
    return resolved.actorKey ? [{ identityField, identityValue: candidate, ...resolved }] : [];
  });
  const actorKeys = [...new Set(matches.map((match) => match.actorKey))];
  if (actorKeys.length > 1) {
    return { actorKey: null, fallback: null, ambiguous: true, missing: false, matches };
  }
  if (actorKeys.length === 1) {
    const authoritativeMatch = matches.find((match) => match.actorKey === actorKeys[0]);
    return { actorKey: actorKeys[0], fallback: null, ambiguous: false, missing: false, matches, ...authoritativeMatch };
  }
  return { actorKey: null, fallback: null, ambiguous: false, missing: true, matches: [] };
}

const explicitNumber = (...values) => {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
};

const looksLikeWeapon = (item) => {
  if (!item) return false;
  if (typeof item === "string") return true;
  const type = keyText(item.type ?? item.kind ?? item.attackType ?? item.category);
  return Boolean(item.damage || /weapon|melee|ranged|sword|dagger|axe|bow/.test(type));
};

function resolveCanonicalLoadout(actor, definition) {
  const requested = [
    ...(Array.isArray(actor.selectedLoadout) ? actor.selectedLoadout : []),
    ...(Array.isArray(actor.selectedCanonicalLoadout) ? actor.selectedCanonicalLoadout : []),
    ...(actor.selectedWeaponProfile ? [actor.selectedWeaponProfile] : []),
    ...(Array.isArray(actor.migrationMetadata?.combatActor?.requestedLoadout)
      ? actor.migrationMetadata.combatActor.requestedLoadout
      : []),
  ].filter((item) => !/unarmed|claw/i.test(String(typeof item === "string" ? item : item?.name || "")));
  if (!requested.length) return { profiles: clone(definition.weaponProfiles), unsupported: [], resolvedAliases: [], safeDefaultUsed: false, requested: false };
  const supported = [];
  const unsupported = [];
  const resolvedAliases = [];
  const seen = new Set();
  requested.forEach((item) => {
    const requestedIdentity = keyText(typeof item === "string" ? item : item?.profileKey || item?.weaponId || item?.id || item?.name)
      .replace(/^weapon\./, "")
      .replace(/-/g, " ");
    const actorProfile = (definition.weaponProfiles || []).find((candidate) => {
      const identities = [candidate.profileKey, candidate.weaponId, candidate.id, candidate.name]
        .map((value) => keyText(value).replace(/^weapon\./, "").replace(/-/g, " "));
      return identities.includes(requestedIdentity);
    });
    const aliasedProfile = actorProfile || getCanonicalWeaponProfileByAlias(item);
    const profile = aliasedProfile && typeof item === "object"
      ? {
          ...aliasedProfile,
          ...item,
          id: aliasedProfile.id,
          weaponId: aliasedProfile.weaponId,
          profileKey: aliasedProfile.profileKey,
          name: aliasedProfile.name,
          damage: item.damage || aliasedProfile.damage,
          damageDice: item.damageDice || item.damage || aliasedProfile.damageDice,
          damageType: item.damageType || aliasedProfile.damageType,
        }
      : aliasedProfile;
    if (!profile) {
      unsupported.push(typeof item === "string" ? item : item?.name || item?.id || "unknown weapon");
      return;
    }
    resolvedAliases.push({ requested: typeof item === "string" ? item : item?.name || item?.id, profileKey: profile.profileKey });
    if (!seen.has(profile.profileKey)) {
      seen.add(profile.profileKey);
      supported.push(profile);
    }
  });
  const safeDefaultUsed = unsupported.length > 0 || supported.length === 0;
  return {
    profiles: safeDefaultUsed ? clone(definition.weaponProfiles) : supported,
    unsupported,
    resolvedAliases,
    safeDefaultUsed,
    requested: true,
  };
}

export function normalizeReferenceCombatActor(actor = {}, { source = "combat-start", emitDiagnostic = null, lifecyclePhase = "combat-start" } = {}) {
  const forbiddenLifecyclePhases = new Set(["attack-resolution", "damage-application", "grapple-resolution", "movement-commit", "flight-movement", "flight-transition", "takeoff", "landing", "altitude-commit", "falling", "linked-falling", "mounted-movement", "mounted-charge", "mounted-attack", "mounted-flight-attack", "aerial-separation", "forced-dismount", "action-continuation", "mounted-continuation", "mounted-flight-continuation", "continuation-admission", "survival-action-commit", "surrender-decision-commit", "wildlife-detection", "hunting-stalk", "hunting-shot", "hunting-pursuit", "companion-command", "companion-carry", "quarry-recovery", "hunting-finalization", "carcass-recovery", "field-dressing", "harvest-resolution", "harvest-inventory-transfer", "projectile-recovery", "carcass-processing-finalization", "food-resource-registration", "fire-ignition", "food-processing-reservation", "food-processing-completion", "food-output-commit", "meal-portion-consumption", "freshness-transition", "food-processing-cancellation", "turn-handoff"]);
  if (forbiddenLifecyclePhases.has(keyText(lifecyclePhase))) {
    const diagnostic = {
      eventType: "combat-actor-normalization-during-owned-action-blocked",
      level: "warning",
      actorId: actor.id ?? actor._id ?? null,
      data: { source, lifecyclePhase },
    };
    emitDiagnostic?.(diagnostic);
    return { normalizedActor: actor, diagnostics: [diagnostic], compatibilityFallbacks: [], blocked: true };
  }
  const resolution = resolveCanonicalCombatActorKey(actor);
  if (!resolution.actorKey) {
    const animalLike = keyText(actor.creatureType || actor.category) === "animal" || keyText(actor.creatureType) === "beast";
    const diagnostic = {
      eventType: animalLike
        ? (resolution.ambiguous ? "animal-canonical-identity-ambiguous" : "animal-canonical-identity-missing")
        : (resolution.ambiguous ? "combat-actor-canonical-identity-ambiguous" : "combat-actor-canonical-identity-missing"),
      level: "warning",
      actorId: actor.id ?? actor._id ?? null,
      data: { source, matches: resolution.matches || [] },
    };
    emitDiagnostic?.(diagnostic);
    return { normalizedActor: { ...actor }, diagnostics: [diagnostic], compatibilityFallbacks: [] };
  }
  const definition = clone(getCanonicalCombatActorDefinition(resolution.actorKey));
  const canonicalAnimal = keyText(definition.creatureType) === "animal";
  const canonicalLoadout = resolveCanonicalLoadout(actor, definition);
  const currentHp = explicitNumber(actor.currentHP, actor.currentHp, actor.hp, actor.HP, definition.currentHP, definition.derivedStats.hp);
  const maxHp = explicitNumber(actor.maxHP, actor.maxHp, definition.derivedStats.maxHp, currentHp);
  const currentStamina = explicitNumber(actor.combatStamina?.current, actor.currentStamina, actor.currentstamina, actor.stamina, definition.combatStamina.current);
  const maximumStamina = explicitNumber(actor.combatStamina?.maximum, actor.maxStamina, actor.maxstamina, definition.combatStamina.maximum);
  const runtimeId = actor.id ?? actor._id ?? definition.id;
  const avianActor = ["hawk", "falcon"].includes(definition?.actorKey);
  const invalidAvianDefinition = avianActor && (
    definition?.anatomyProfile?.bodyPlan !== "avian"
    || definition?.anatomyProfile?.wingsPresent !== true
    || Number(definition?.anatomyProfile?.wingCount || 0) < 2
    || (definition?.naturalAttackProfiles || []).some(
      (profile) => profile?.anatomySource === "talons" && definition?.anatomyProfile?.talonsPresent !== true,
    )
  );
  if (invalidAvianDefinition) {
    const diagnostic = {
      eventType: definition?.anatomyProfile?.bodyPlan !== "avian"
        ? "hawk-quadruped-body-plan"
        : "avian-wing-anatomy-missing",
      level: "error",
      actorId: runtimeId,
      data: { actorKey: definition.actorKey, source },
    };
    emitDiagnostic?.(diagnostic);
    return { normalizedActor: actor, diagnostics: [diagnostic], compatibilityFallbacks: [], blocked: true };
  }
  const team = actor.team ?? actor.side ?? actor.battleSide ?? definition.teamDefault;
  const alignmentBehavior = normalizeAlignmentBehavior(actor.behaviorProfile || actor.alignment || definition.alignment, actor.behavior || {});
  const selectedLoadoutAccepted = canonicalLoadout.requested && !canonicalLoadout.safeDefaultUsed;
  const resolvedLoadoutKey = selectedLoadoutAccepted ? "selected" : (definition.defaultLoadoutKey || definition.loadoutKey || "default");
  const preserved = {
    id: runtimeId,
    ...(actor._id !== undefined ? { _id: actor._id } : {}),
    team,
    side: actor.side ?? team,
    battleSide: actor.battleSide ?? team,
    factionId: actor.factionId,
    armyId: actor.armyId,
    type: actor.type,
    controlMode: actor.controlMode ?? definition.defaultControlMode,
    instanceId: actor.instanceId,
    position: clone(actor.position), hex: clone(actor.hex), x: actor.x, y: actor.y,
    flightState: clone(actor.flightState),
    carrierLink: clone(actor.carrierLink),
    mountedState: clone(actor.mountedState),
    mountedTurn: clone(actor.mountedTurn),
    mountedFlightState: clone(actor.mountedFlightState),
    mountedFlightTurn: clone(actor.mountedFlightTurn),
    attachmentState: actor.attachmentState,
    loadState: actor.loadState,
    fallState: clone(actor.fallState),
    altitude: actor.altitude,
    altitudeFeet: actor.altitudeFeet,
    currentHP: currentHp, currentHp, hp: currentHp, HP: currentHp, maxHP: maxHp, maxHp,
    currentStamina,
    ...(actor.maxStamina !== undefined || actor.maxstamina !== undefined || actor.staminaMax !== undefined
      ? { maxStamina: maximumStamina }
      : {}),
    combatStamina: { ...definition.combatStamina, ...(actor.combatStamina || {}), current: currentStamina, maximum: maximumStamina, authority: "combatStamina" },
    grappleState: clone(actor.grappleState), surrenderState: clone(actor.surrenderState), combatWeaponState: clone(actor.combatWeaponState),
    initiativeTurnId: actor.initiativeTurnId, actionToken: actor.actionToken, initiativeIdentity: clone(actor.initiativeIdentity),
    remainingActions: actor.remainingActions ?? definition.actionsPerRound,
    ammunitionState: clone(actor.ammunitionState),
    currentTarget: clone(actor.currentTarget), targetId: actor.targetId,
    moraleState: clone(actor.moraleState), survivalState: clone(actor.survivalState),
    statusEffects: clone(actor.statusEffects), injuryState: clone(actor.injuryState),
    animalIntent: clone(actor.animalIntent),
    huntingEncounterId: actor.huntingEncounterId,
    trackState: clone(actor.trackState),
    pursuitState: clone(actor.pursuitState),
    recoveryState: clone(actor.recoveryState),
    carcassState: clone(actor.carcassState),
    carcassId: actor.carcassId,
    sourceActorId: actor.sourceActorId,
    deathEventId: actor.deathEventId,
    carcassClaim: clone(actor.carcassClaim),
    conditionProfile: clone(actor.conditionProfile),
    harvestProfileKey: actor.harvestProfileKey,
    processingState: actor.processingState,
    remainingResources: clone(actor.remainingResources),
    projectileRecoveryRecords: clone(actor.projectileRecoveryRecords),
    spoilageState: clone(actor.spoilageState),
    inventoryTransferState: clone(actor.inventoryTransferState),
    processingOwnerToken: actor.processingOwnerToken,
    recoveryOwnerToken: actor.recoveryOwnerToken,
    foodState: clone(actor.foodState),
    foodProcessingContext: clone(actor.foodProcessingContext),
    heatSourceState: clone(actor.heatSourceState),
    nourishmentState: clone(actor.nourishmentState),
    foodStorageContext: clone(actor.foodStorageContext),
    companionLink: clone(actor.companionLink),
    currentCommand: actor.currentCommand,
    handlerId: actor.handlerId,
  };
  const normalizedActor = {
    ...definition,
    ...actor,
    ...preserved,
    combatActorSchemaVersion: 1,
    actorKey: definition.actorKey,
    species: definition.species,
    creatureType: definition.creatureType,
    size: definition.size,
    role: definition.role,
    tags: [...definition.tags],
    traitKeys: [...definition.traitKeys],
    traits: [...definition.traits],
    attributes: { ...definition.attributes },
    abilityScores: {
      ...definition.abilityScores,
      str: definition.abilityScores?.strength ?? definition.abilityScores?.str,
      dex: definition.abilityScores?.dexterity ?? definition.abilityScores?.dex,
      con: definition.abilityScores?.constitution ?? definition.abilityScores?.con,
      int: definition.abilityScores?.intelligence ?? definition.abilityScores?.int,
      wis: definition.abilityScores?.wisdom ?? definition.abilityScores?.wis,
      cha: definition.abilityScores?.charisma ?? definition.abilityScores?.cha,
    },
    movementModes: [...definition.movementModes],
    movement: clone(definition.movement),
    movementSpeed: definition.movement.ground,
    speed: definition.movement.ground,
    derivedStats: { ...definition.derivedStats, hp: currentHp, maxHp, maxHP: maxHp },
    inventory: clone(canonicalAnimal ? definition.inventory : [...canonicalLoadout.profiles, ...definition.equipment.filter((item) => !looksLikeWeapon(item))]),
    equipment: clone(canonicalAnimal ? definition.equipment : [...canonicalLoadout.profiles, ...definition.equipment.filter((item) => !looksLikeWeapon(item))]),
    equippedArmor: clone(definition.equippedArmor),
    wornArmor: clone(definition.wornArmor || definition.equippedArmor),
    equippedShield: clone(definition.equippedShield),
    armorProfile: clone(definition.armorProfile),
    heldItems: canonicalAnimal
      ? clone(definition.heldItems)
      : { ...clone(definition.heldItems), mainHand: canonicalLoadout.profiles[0]?.profileKey || definition.heldItems?.mainHand || null },
    loadoutKey: resolvedLoadoutKey,
    defaultLoadoutKey: definition.defaultLoadoutKey || definition.loadoutKey || "default",
    loadouts: selectedLoadoutAccepted
      ? { ...clone(definition.loadouts), selected: { loadoutKey: "selected", weaponProfileKeys: canonicalLoadout.profiles.map((profile) => profile.profileKey), heldItems: { ...clone(definition.heldItems), mainHand: canonicalLoadout.profiles[0]?.profileKey || null } } }
      : clone(definition.loadouts),
    attacks: clone(canonicalLoadout.profiles),
    weaponProfiles: clone(canonicalLoadout.profiles),
    naturalAttackProfiles: clone(definition.naturalAttackProfiles || []),
    anatomyProfile: clone(definition.anatomyProfile),
    defenseProfile: clone(definition.defenseProfile),
    survivalProfile: clone(definition.survivalProfile),
    tacticalProfile: clone(definition.tacticalProfile),
    ecologyTags: clone(definition.ecologyTags || []),
    equistaminadWeapons: clone(canonicalLoadout.profiles.filter((profile) => profile.naturalWeapon !== true)),
    grappleProfile: clone(definition.grappleProfile),
    moraleProfile: clone(definition.moraleProfile),
    surrenderProfile: clone(definition.surrenderProfile),
    ammunition: clone(definition.ammunition || []),
    ammunitionState: normalizeCanonicalAmmunitionState(
      { ...definition, ...actor, inventory: actor.inventory || definition.inventory, ammunitionState: actor.ammunitionState || definition.ammunitionState },
      canonicalLoadout.profiles.find((profile) => profile.deliveryType === "projectile"),
    ),
    rangedTacticalProfile: clone(definition.rangedTacticalProfile),
    rangedTrainingProfile: clone(definition.rangedTrainingProfile),
    flightProfile: clone(definition.flightProfile),
    carrierProfile: clone(definition.carrierProfile),
    passengerProfile: clone(definition.passengerProfile),
    mountProfile: clone(definition.mountProfile),
    flyingMountProfile: clone(definition.flyingMountProfile),
    wildlifeBehaviorProfile: clone(definition.wildlifeBehaviorProfile),
    perceptionProfile: clone(definition.perceptionProfile),
    quarryProfile: clone(definition.quarryProfile),
    companionProfile: clone(definition.companionProfile),
    riderProfile: clone(definition.riderProfile),
    behavior: canonicalAnimal ? { ...definition.behavior, ...(actor.behavior || {}) } : { ...definition.behavior, ...(alignmentBehavior || {}) },
    behaviorProfile: canonicalAnimal ? null : alignmentBehavior,
    alignment: canonicalAnimal ? null : (alignmentBehavior?.alignmentKey || actor.alignment || definition.alignment),
    alignmentName: canonicalAnimal ? "Unaligned" : (alignmentBehavior?.alignmentName || actor.alignmentName || definition.alignmentName),
    schemaNormalizedAt: source,
    migrationMetadata: {
      ...(actor.migrationMetadata || {}),
      combatActor: {
        ...(actor.migrationMetadata?.combatActor || {}),
        actorKey: definition.actorKey,
        legacyAlignment: actor.alignment || actor.alignmentName || actor.alignmentText || null,
        requestedLoadout: [
          ...(Array.isArray(actor.selectedLoadout) ? actor.selectedLoadout : []),
          ...(Array.isArray(actor.selectedCanonicalLoadout) ? actor.selectedCanonicalLoadout : []),
        ].map((item) => typeof item === "string" ? item : item?.name || item?.id).filter(Boolean),
        unsupportedWeaponsReplaced: [...canonicalLoadout.unsupported],
      },
    },
  };
  if (definition.flightProfile?.kind === "biological") {
    const canonicalFlight = normalizeCanonicalFlightState({
      ...normalizedActor,
      flightState: preserved.flightState || definition.flightState,
      position: preserved.position,
      altitude: preserved.altitude,
      altitudeFeet: preserved.altitudeFeet,
    });
    Object.assign(normalizedActor, canonicalFlight.actor);
  }
  for (const legacyField of ["alignmentText", "alignment_options", "alignmentOptions", "alignment_tendency", "selectedLoadout", "selectedCanonicalLoadout", "selectedWeaponProfile"]) {
    delete normalizedActor[legacyField];
  }
  // Live ownership and position fields are never inferred from the reference definition.
  for (const field of ["position", "hex", "x", "y", "carrierLink", "mountedState", "mountedTurn", "mountedFlightState", "mountedFlightTurn", "attachmentState", "loadState", "fallState", "grappleState", "surrenderState", "combatWeaponState", "animalIntent", "huntingEncounterId", "trackState", "pursuitState", "recoveryState", "carcassState", "carcassId", "sourceActorId", "deathEventId", "carcassClaim", "conditionProfile", "harvestProfileKey", "processingState", "remainingResources", "projectileRecoveryRecords", "spoilageState", "inventoryTransferState", "processingOwnerToken", "recoveryOwnerToken", "foodState", "foodProcessingContext", "heatSourceState", "nourishmentState", "foodStorageContext", "companionLink", "currentCommand", "handlerId", "initiativeTurnId", "actionToken", "initiativeIdentity", "instanceId", "factionId", "armyId"]) {
    if (preserved[field] === undefined && !(field === "position" && definition.flightProfile?.kind === "biological")) delete normalizedActor[field];
  }
  if (!normalizedActor.combatWeaponState) {
    normalizedActor.combatWeaponState = {
      readyWeaponId: canonicalAnimal ? null : (canonicalLoadout.profiles[0]?.profileKey || definition.heldItems.mainHand),
      retainedWeaponId: null,
      retainedWeaponDisposition: null,
      clinchWeaponId: null,
      clinchWeaponReady: false,
      droppedWeaponIds: [],
      lastTransitionReason: "combat-actor-schema-normalized",
    };
  }
  const compatibilityFallbacks = resolution.fallback ? [resolution.fallback] : [];
  const diagnostics = [{
    eventType: "combat-actor-canonical-identity-resolved",
    level: "info",
    actorId: runtimeId,
    data: { actorKey: definition.actorKey, identityField: resolution.identityField, source },
  }, {
    eventType: "combat-actor-schema-normalized",
    level: "info",
    actorId: runtimeId,
    data: { actorKey: definition.actorKey, schemaVersion: 1, source },
  }];
  if (canonicalAnimal) diagnostics.push({
    eventType: "animal-canonical-identity-resolved",
    level: "info",
    actorId: runtimeId,
    data: { actorKey: definition.actorKey, identityField: resolution.identityField, source },
  }, {
    eventType: "animal-anatomy-validated",
    level: "info",
    actorId: runtimeId,
    data: { actorKey: definition.actorKey, bodyPlan: definition.anatomyProfile?.bodyPlan, source },
  }, ...(definition.naturalAttackProfiles || []).map((profile) => ({
    eventType: "natural-attack-profile-resolved",
    level: "info",
    actorId: runtimeId,
    data: { actorKey: definition.actorKey, attackKey: profile.attackKey, profileKey: profile.profileKey, source },
  })));
  if (definition.flightProfile?.kind === "biological") diagnostics.push({
    eventType: "flying-animal-identity-resolved",
    level: "info",
    actorId: runtimeId,
    data: { actorKey: definition.actorKey, species: definition.species, source },
  }, {
    eventType: "flight-state-normalized",
    level: "info",
    actorId: runtimeId,
    data: {
      actorKey: definition.actorKey,
      mode: normalizedActor.flightState?.mode,
      altitudeFeet: normalizedActor.flightState?.altitudeFeet,
      source,
    },
  });
  if (resolution.aliasUsed) diagnostics.push({
    eventType: canonicalAnimal ? "animal-migration-alias-used" : "combat-actor-migration-alias-used",
    level: "info",
    actorId: runtimeId,
    data: { actorKey: definition.actorKey, alias: resolution.alias, identityField: resolution.identityField, source },
  });
  canonicalLoadout.resolvedAliases.forEach((resolvedAlias) => diagnostics.push({
    eventType: "combat-weapon-profile-alias-resolved",
    level: "info",
    actorId: runtimeId,
    data: { actorKey: definition.actorKey, ...resolvedAlias, source },
  }));
  canonicalLoadout.unsupported.forEach((weaponName) => diagnostics.push({
    eventType: "combat-weapon-profile-unsupported",
    level: "warning",
    actorId: runtimeId,
    data: { actorKey: definition.actorKey, weaponName, replacementWeaponId: canonicalLoadout.profiles[0]?.profileKey || definition.heldItems?.mainHand || null, source },
  }));
  canonicalLoadout.unsupported.forEach((weaponName) => diagnostics.push({
    eventType: "combat-actor-unsupported-weapon-replaced",
    level: "warning",
    actorId: runtimeId,
    data: { actorKey: definition.actorKey, weaponName, replacementWeaponId: canonicalLoadout.profiles[0]?.profileKey || definition.heldItems?.mainHand || null, source },
  }));
  if (canonicalLoadout.safeDefaultUsed && canonicalLoadout.unsupported.length) diagnostics.push({
    eventType: "combat-weapon-safe-default-used",
    level: "warning",
    actorId: runtimeId,
    data: { actorKey: definition.actorKey, replacementWeaponIds: canonicalLoadout.profiles.map((profile) => profile.profileKey), source },
  }, {
    eventType: "combat-actor-safe-loadout-substituted",
    level: "warning",
    actorId: runtimeId,
    data: { actorKey: definition.actorKey, loadoutKey: definition.defaultLoadoutKey || "default", source },
  });
  if (resolution.fallback) diagnostics.push({
    eventType: "combat-actor-compatibility-fallback-used", level: "warning", actorId: runtimeId,
    data: { fallback: resolution.fallback, source },
  });
  diagnostics.forEach((diagnostic) => emitDiagnostic?.(diagnostic));
  return { normalizedActor, diagnostics, compatibilityFallbacks };
}

export default normalizeReferenceCombatActor;
