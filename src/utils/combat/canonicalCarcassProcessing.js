import { createCanonicalCarcassState } from "./canonicalHuntingEncounter.js";

const idOf = (actor) => actor?.id ?? actor?._id ?? null;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const text = (value) => String(value ?? "").trim().toLowerCase();
const freeze = (value) => Object.freeze({ ...value });
const point = (value = {}) => freeze({
  x: finite(value.position?.x ?? value.x),
  y: finite(value.position?.y ?? value.y),
  altitudeFeet: Math.max(0, finite(value.position?.altitudeFeet ?? value.altitudeFeet ?? value.altitude)),
});
const distance = (a, b) => Math.hypot(
  finite(a?.x) - finite(b?.x),
  finite(a?.y) - finite(b?.y),
  finite(a?.altitudeFeet) - finite(b?.altitudeFeet),
);
const event = (eventType, record = {}, data = {}) => ({
  eventType,
  actorId: data.actorId ?? record.processorId ?? record.claimantId ?? null,
  targetId: data.targetId ?? record.sourceActorId ?? null,
  data: {
    carcassId: record.carcassId ?? null,
    generationId: record.generationId ?? null,
    initiativeTurnId: record.initiativeTurnId ?? null,
    actionToken: record.actionToken ?? null,
    ...data,
  },
});
const reject = (reason, record = {}, eventType = "stale-harvest-callback-rejected", data = {}) => ({
  accepted: false,
  reason,
  events: [event(eventType, record, { reason, ...data })],
});
const inventoryWeight = (inventory = []) => inventory.reduce((sum, item) => sum + Math.max(0, finite(item?.weight)), 0);
const resolveCapacity = ({ recipient, inventory, capacity, capacityAuthority }) => {
  const authoritative = typeof capacityAuthority === "function"
    ? capacityAuthority({ ...recipient, inventory })
    : null;
  const maximum = capacity !== null && capacity !== undefined
    ? finite(capacity)
    : finite(authoritative?.maxWeight);
  return {
    currentWeight: authoritative ? finite(authoritative.currentWeight) : inventoryWeight(inventory),
    maxWeight: maximum,
    source: authoritative ? "injected-existing-encumbrance-authority" : "explicit-capacity-snapshot",
  };
};

const resource = ({
  resourceKey,
  displayName,
  category,
  unitWeight,
  stackMaximum = 99,
  rawState = "raw",
  spoilageProfileKey = null,
}) => freeze({
  itemKey: `resource.${resourceKey}`,
  inventoryItemKey: `resource.${resourceKey}`,
  resourceKey,
  displayName,
  name: displayName,
  category,
  type: "harvest-resource",
  unitWeight,
  stackProfile: freeze({ stackable: true, maximum: stackMaximum, identityField: "itemKey" }),
  rawState,
  spoilageProfileKey,
  sourceSpeciesTags: Object.freeze(["animal"]),
  boundaryTags: Object.freeze([
    ...(category === "food" ? ["cooking-deferred", "preservation-deferred"] : ["crafting-deferred"]),
  ]),
  combatProperties: null,
  tradeValue: null,
});

export const CANONICAL_HARVEST_RESOURCE_ITEMS = Object.freeze({
  meat: resource({ resourceKey: "raw-game-meat", displayName: "Raw Game Meat", category: "food", unitWeight: 1, spoilageProfileKey: "raw-game-meat-boundary" }),
  hide: resource({ resourceKey: "raw-hide", displayName: "Raw Hide", category: "material", unitWeight: 5 }),
  fur: resource({ resourceKey: "fur-pelt", displayName: "Raw Fur Pelt", category: "material", unitWeight: 3 }),
  fat: resource({ resourceKey: "animal-fat", displayName: "Animal Fat", category: "food-material", unitWeight: 1, spoilageProfileKey: "raw-animal-fat-boundary" }),
  bone: resource({ resourceKey: "animal-bone", displayName: "Animal Bone", category: "material", unitWeight: 1 }),
  tusk: resource({ resourceKey: "animal-tusk", displayName: "Animal Tusk", category: "material", unitWeight: 2 }),
  tooth: resource({ resourceKey: "animal-tooth", displayName: "Animal Tooth", category: "material", unitWeight: 0.1 }),
  claw: resource({ resourceKey: "animal-claw", displayName: "Animal Claw", category: "material", unitWeight: 0.25 }),
  feather: resource({ resourceKey: "flight-feather", displayName: "Flight Feather", category: "material", unitWeight: 0.05 }),
  recoveredArrow: resource({ resourceKey: "recovered-arrow", displayName: "Recovered Arrow", category: "ammunition", unitWeight: 0.1 }),
  damagedArrow: resource({ resourceKey: "damaged-arrow", displayName: "Damaged Arrow", category: "ammunition-material", unitWeight: 0.1 }),
});

const profileResource = (resourceKey, quantity, options = {}) => freeze({
  resourceKey,
  inventoryItemKey: CANONICAL_HARVEST_RESOURCE_ITEMS[resourceKey]?.inventoryItemKey,
  sourceLocations: Object.freeze(options.sourceLocations || ["body"]),
  requiresFieldDressing: options.requiresFieldDressing !== false,
  requiresSkinning: options.requiresSkinning === true,
  conditionDependencies: Object.freeze(options.conditionDependencies || []),
  quantityAuthority: freeze({
    type: "project-owned-conservative-profile",
    quantity,
    compatibilityClass: options.compatibilityClass || "moderate",
  }),
  weightAuthority: "canonical-harvest-resource-item",
  stackProfile: CANONICAL_HARVEST_RESOURCE_ITEMS[resourceKey]?.stackProfile,
});

const harvestProfile = (profileKey, species, sizeClass, resources, options = {}) => freeze({
  profileKey,
  species,
  sizeClass,
  potentialResources: Object.freeze(resources),
  fieldDressingRequired: options.fieldDressingRequired !== false,
  skillProfile: freeze({ preferredSkills: Object.freeze(["Wilderness Survival", "Survival"]), uncertaintyOnly: true }),
  toolRequirements: freeze({
    fieldDressing: Object.freeze(["field-dressing", "fine-cutting"]),
    skinning: Object.freeze(["skinning", "fine-cutting"]),
    bone: Object.freeze(["bone-cutting", "butchering"]),
  }),
  spoilageProfileKey: "descriptive-freshness-boundary",
  projectileRecoverySupported: true,
  protectedByDefault: options.protectedByDefault === true,
  foodSafety: options.foodSafety || "ordinary-game",
});

export const CANONICAL_HARVEST_PROFILES = Object.freeze({
  boar: harvestProfile("harvest.boar", "boar", "medium", [
    profileResource("meat", 12, { sourceLocations: ["torso", "limbs"], compatibilityClass: "substantial" }),
    profileResource("hide", 1, { requiresSkinning: true, sourceLocations: ["skin"], compatibilityClass: "moderate" }),
    profileResource("fat", 3, { sourceLocations: ["torso"], compatibilityClass: "moderate" }),
    profileResource("tusk", 2, { requiresFieldDressing: false, sourceLocations: ["tusks"], compatibilityClass: "small" }),
    profileResource("bone", 5, { sourceLocations: ["skeleton"], compatibilityClass: "moderate" }),
  ]),
  wolf: harvestProfile("harvest.wolf", "wolf", "medium", [
    profileResource("fur", 1, { requiresSkinning: true, sourceLocations: ["skin"] }),
    profileResource("bone", 3, { sourceLocations: ["skeleton"] }),
    profileResource("tooth", 4, { requiresFieldDressing: false, sourceLocations: ["teeth"], compatibilityClass: "small" }),
  ], { foodSafety: "scenario-dependent" }),
  bear: harvestProfile("harvest.bear", "bear", "large", [
    profileResource("meat", 24, { sourceLocations: ["torso", "limbs"], compatibilityClass: "large" }),
    profileResource("fur", 1, { requiresSkinning: true, sourceLocations: ["skin"], compatibilityClass: "substantial" }),
    profileResource("fat", 8, { sourceLocations: ["torso"], compatibilityClass: "substantial" }),
    profileResource("claw", 8, { requiresFieldDressing: false, sourceLocations: ["claws"] }),
    profileResource("tooth", 6, { requiresFieldDressing: false, sourceLocations: ["teeth"] }),
    profileResource("bone", 10, { sourceLocations: ["skeleton"], compatibilityClass: "large" }),
  ]),
  "brown-bear": harvestProfile("harvest.brown-bear", "brown-bear", "large", [
    profileResource("meat", 28, { sourceLocations: ["torso", "limbs"], compatibilityClass: "large" }),
    profileResource("fur", 1, { requiresSkinning: true, sourceLocations: ["skin"], compatibilityClass: "substantial" }),
    profileResource("fat", 10, { sourceLocations: ["torso"], compatibilityClass: "substantial" }),
    profileResource("claw", 8, { requiresFieldDressing: false, sourceLocations: ["claws"] }),
    profileResource("tooth", 6, { requiresFieldDressing: false, sourceLocations: ["teeth"] }),
    profileResource("bone", 12, { sourceLocations: ["skeleton"], compatibilityClass: "large" }),
  ]),
  "giant-rat": harvestProfile("harvest.giant-rat", "giant-rat", "small", [
    profileResource("fur", 1, { requiresSkinning: true, sourceLocations: ["skin"], compatibilityClass: "small" }),
    profileResource("bone", 1, { sourceLocations: ["skeleton"], compatibilityClass: "small" }),
  ], { foodSafety: "contamination-restricted" }),
  mastiff: harvestProfile("harvest.mastiff", "mastiff", "medium", [], { protectedByDefault: true, foodSafety: "companion-protected" }),
  warhorse: harvestProfile("harvest.warhorse", "horse", "large", [], { protectedByDefault: true, foodSafety: "mount-protected" }),
  hawk: harvestProfile("harvest.hawk", "hawk", "small", [
    profileResource("feather", 4, { requiresFieldDressing: false, sourceLocations: ["wings"], compatibilityClass: "small" }),
  ], { protectedByDefault: true, foodSafety: "companion-protected" }),
  falcon: harvestProfile("harvest.falcon", "falcon", "small", [
    profileResource("feather", 4, { requiresFieldDressing: false, sourceLocations: ["wings"], compatibilityClass: "small" }),
  ], { protectedByDefault: true, foodSafety: "companion-protected" }),
});

const processingAction = (key, options = {}) => freeze({
  key,
  label: options.label,
  legalRecoveryStates: Object.freeze(options.legalRecoveryStates || ["recovered", "claimed"]),
  legalProcessingStates: Object.freeze(options.legalProcessingStates || ["intact", "field-dressed", "partially-harvested"]),
  executor: options.executor,
  owner: options.owner || "processor",
  toolCapability: options.toolCapability || null,
  targetType: "carcass",
  actionCost: options.actionCost ?? 1,
  timeClass: options.timeClass || "short",
  rollBehavior: options.rollBehavior || "uncertainty-only",
  inventoryTransferBehavior: options.inventoryTransferBehavior || "none",
  completionBehavior: "exactly-once-owned-processing-action",
  playerVisible: options.playerVisible !== false,
  aiAvailable: options.aiAvailable !== false,
  resourceKey: options.resourceKey || null,
});

export const CARCASS_PROCESSING_ACTIONS = Object.freeze({
  "recover-carcass": processingAction("recover-carcass", { label: "Recover Carcass", executor: "recoverProcessingCarcass", legalRecoveryStates: ["located"] }),
  "claim-carcass": processingAction("claim-carcass", { label: "Claim Carcass", executor: "establishCanonicalCarcassClaim" }),
  "field-dress-carcass": processingAction("field-dress-carcass", { label: "Field Dress Carcass", executor: "completeCanonicalFieldDressing", toolCapability: "field-dressing", timeClass: "moderate" }),
  "harvest-meat": processingAction("harvest-meat", { label: "Harvest Meat", executor: "resolveHarvestYield", resourceKey: "meat", toolCapability: "butchering", inventoryTransferBehavior: "capacity-checked" }),
  "skin-carcass": processingAction("skin-carcass", { label: "Skin Carcass", executor: "resolveHarvestYield", resourceKey: "fur", toolCapability: "skinning", inventoryTransferBehavior: "capacity-checked" }),
  "recover-hide": processingAction("recover-hide", { label: "Recover Hide", executor: "resolveHarvestYield", resourceKey: "hide", toolCapability: "skinning", inventoryTransferBehavior: "capacity-checked" }),
  "recover-tusks": processingAction("recover-tusks", { label: "Recover Tusks", executor: "resolveHarvestYield", resourceKey: "tusk", toolCapability: "fine-cutting", inventoryTransferBehavior: "capacity-checked" }),
  "recover-claws": processingAction("recover-claws", { label: "Recover Claws", executor: "resolveHarvestYield", resourceKey: "claw", toolCapability: "fine-cutting", inventoryTransferBehavior: "capacity-checked" }),
  "recover-feathers": processingAction("recover-feathers", { label: "Recover Feathers", executor: "resolveHarvestYield", resourceKey: "feather", inventoryTransferBehavior: "capacity-checked" }),
  "recover-bones": processingAction("recover-bones", { label: "Recover Bones", executor: "resolveHarvestYield", resourceKey: "bone", toolCapability: "bone-cutting", inventoryTransferBehavior: "capacity-checked" }),
  "recover-embedded-projectile": processingAction("recover-embedded-projectile", { label: "Recover Embedded Projectile", executor: "recoverCanonicalEmbeddedProjectile", toolCapability: "fine-cutting", inventoryTransferBehavior: "capacity-checked" }),
  "abandon-carcass": processingAction("abandon-carcass", { label: "Abandon Carcass", executor: "abandonCanonicalCarcass", toolCapability: null, timeClass: "immediate" }),
});

export function createCanonicalCarcassProcessingRegistry() {
  return {
    actionClaims: new Map(),
    completedActionTokens: new Set(),
    resourceReservations: new Map(),
    completedTransferTokens: new Set(),
    completedProjectileIds: new Set(),
    processingFinalizers: new Set(),
  };
}

export function createCanonicalProcessingCarcass({
  huntingRegistry,
  sourceActor,
  generationId,
  huntingEncounterId = null,
  deathEventId,
  deathTime = Date.now(),
  deathRound = null,
  deathPosition,
  causeOfDeath = "unknown",
  primaryInjuries = [],
  contaminationTags = [],
  embeddedProjectiles = [],
  recoveryDelayClass = "immediate",
} = {}) {
  const sourceActorId = idOf(sourceActor);
  const record = { generationId, sourceActorId };
  if (
    !huntingRegistry || !sourceActorId || sourceActor?.creatureType !== "animal"
    || !(sourceActor.dead === true || sourceActor.isDead === true) || sourceActor.unconscious === true
    || sourceActor.surrendered === true || sourceActor.captured === true
    || sourceActor.escaped === true || !deathEventId
  ) return reject("carcass-without-death", record, "carcass-eligibility-resolved");
  const created = createCanonicalCarcassState({
    registry: huntingRegistry,
    sourceActor,
    generationId,
    huntingEncounterId,
    deathEventId,
    deathTime,
    deathRound,
    deathLocation: deathPosition,
    causeOfDeath,
    primaryInjuries,
    projectileIds: embeddedProjectiles.filter((entry) => entry.embedded && !entry.missed).map((entry) => entry.projectileId),
  });
  if (!created.accepted) return {
    ...created,
    events: [event(created.reason === "duplicate-carcass" ? "duplicate-carcass" : "carcass-eligibility-resolved", record, { reason: created.reason })],
  };
  const carcass = huntingRegistry.carcasses.get(created.carcassState.carcassId);
  carcass.conditionProfile = resolveCanonicalCarcassCondition({
    sourceActor, primaryInjuries, contaminationTags, recoveryDelayClass,
  });
  const projectileRecords = createCanonicalProjectileRecoveryRecords({ carcass, projectiles: embeddedProjectiles });
  return {
    accepted: true,
    carcass,
    projectileRecords,
    events: [
      event("carcass-eligibility-resolved", carcass, { authorized: true }),
      event("carcass-created", carcass, { deathEventId }),
    ],
  };
}

export function resolveCanonicalCarcassCondition({
  sourceActor,
  primaryInjuries = [],
  contaminationTags = [],
  recoveryDelayClass = "immediate",
} = {}) {
  const lostLocations = (sourceActor?.injuryState?.lostLocations || []).map(text);
  const damagedLocations = [
    ...primaryInjuries.map(text),
    ...(sourceActor?.injuryState?.damagedLocations || []).map(text),
  ];
  const burnExposure = contaminationTags.includes("fire-damaged") || damagedLocations.some((entry) => entry.includes("burn"));
  const poisonExposure = contaminationTags.includes("poison-exposure");
  const diseaseConcern = contaminationTags.includes("disease-concern");
  return freeze({
    freshnessState: recoveryDelayClass === "long" ? "aging" : "fresh",
    bodyCondition: lostLocations.length > 2 ? "mutilated" : damagedLocations.length > 2 ? "heavily-damaged" : damagedLocations.length ? "damaged" : "intact",
    contaminationTags: Object.freeze([...contaminationTags]),
    damagedLocations: Object.freeze(damagedLocations),
    lostLocations: Object.freeze(lostLocations),
    bleedLossClass: sourceActor?.conditions?.some((entry) => text(entry.type) === "bleeding") ? "present" : "none-known",
    burnExposure,
    poisonExposure,
    diseaseConcern,
    recoveryDelayClass,
  });
}

export function resolveCarcassHarvestEligibility({
  carcass,
  sourceActor,
  companionLink = null,
  mountLink = null,
  scenarioRules = {},
} = {}) {
  if (!carcass?.deathEventId || !(sourceActor?.dead || sourceActor?.isDead) || carcass.sourceActorId !== idOf(sourceActor)) {
    return reject("carcass-without-death", carcass, "carcass-eligibility-resolved");
  }
  const profile = CANONICAL_HARVEST_PROFILES[sourceActor.actorKey];
  if (!profile) return reject("harvest-profile-missing", carcass, "carcass-eligibility-resolved");
  const companionProtected = profile.protectedByDefault && Boolean(companionLink || sourceActor.companionProfile?.enabled);
  const mountProtected = profile.protectedByDefault && Boolean(mountLink || sourceActor.mountProfile?.mayServeAsMount);
  const explicitlyAuthorized = scenarioRules.authorizeProtectedAnimalHarvest === true;
  const classification = companionProtected && !explicitlyAuthorized
    ? "companion-protected"
    : mountProtected && !explicitlyAuthorized
      ? "mount-protected"
      : explicitlyAuthorized
        ? "scenario-authorized"
        : "ordinary-game";
  const authorized = !["companion-protected", "mount-protected"].includes(classification);
  carcass.harvestEligibilityClassification = classification;
  carcass.harvestEligibilityAuthorized = authorized;
  return {
    accepted: true,
    authorized,
    classification,
    harvestProfile: profile,
    events: [event("carcass-eligibility-resolved", carcass, { classification, authorized })],
  };
}

export function locateCanonicalCarcass({ carcass, locatedPosition, locatorId } = {}) {
  if (!carcass || carcass.recoveryState !== "unrecovered" || !locatorId) return reject("carcass-location-rejected", carcass);
  const authoritativePosition = point(locatedPosition || carcass.deathPosition);
  if (distance(authoritativePosition, carcass.deathPosition) > 0.01) return reject("carcass-location-mismatch", carcass);
  carcass.recoveryState = "located";
  carcass.locatedPosition = authoritativePosition;
  return { accepted: true, carcass, events: [event("carcass-recovery-requested", carcass, { actorId: locatorId, recoveryState: "located" })] };
}

export function recoverProcessingCarcass({
  carcass,
  processor,
  processorPosition,
  actionToken,
  safeAccess = true,
  maximumReachFeet = 5,
} = {}) {
  const processorId = idOf(processor);
  const record = { ...carcass, processorId, actionToken };
  if (!carcass || carcass.recoveryState !== "located" || !processorId || !actionToken || !safeAccess) return reject("harvest-before-recovery", record);
  if (distance(point(processorPosition || processor), carcass.locatedPosition || carcass.deathPosition) > maximumReachFeet) return reject("carcass-recovery-position-illegal", record);
  carcass.recoveryState = "recovered";
  carcass.recovered = true;
  carcass.recoveryOwnerToken = actionToken;
  carcass.recoveryPosition = carcass.locatedPosition || carcass.deathPosition;
  carcass.state = "recovered";
  return {
    accepted: true,
    carcass,
    events: [event("carcass-recovered", record, { actorId: processorId, recoveryState: "recovered" })],
  };
}

export function establishCanonicalCarcassClaim({
  carcass,
  claimant,
  claimantType = "hunter",
  partyId = null,
  claimSource = "encounter-owner",
  claimedAt = Date.now(),
} = {}) {
  const claimantId = idOf(claimant);
  if (!carcass || carcass.recoveryState !== "recovered" || !claimantId || carcass.carcassClaim) return reject("claimant-missing", carcass);
  const carcassClaim = freeze({ claimantType, claimantId, partyId, claimedAt, claimSource, state: "active" });
  carcass.carcassClaim = carcassClaim;
  carcass.claimantId = claimantId;
  carcass.claimedByActorId = claimantId;
  carcass.recoveryState = "claimed";
  return {
    accepted: true,
    carcass,
    carcassClaim,
    events: [event("carcass-claim-established", carcass, { actorId: claimantId, claimantType })],
  };
}

export function classifyCanonicalProcessingTool(tool = {}) {
  const identity = text(tool.profileKey || tool.weaponId || tool.itemKey || tool.id || tool.name);
  const capabilities = new Set(tool.processingCapabilities || []);
  if (["knife", "dagger", "misericorde"].some((term) => identity.includes(term))) {
    capabilities.add("field-dressing");
    capabilities.add("skinning");
    capabilities.add("butchering");
    capabilities.add("fine-cutting");
  }
  if (["axe", "hatchet", "cleaver"].some((term) => identity.includes(term))) {
    capabilities.add("butchering");
    capabilities.add("bone-cutting");
  }
  return freeze({
    sourceItemKey: tool.profileKey || tool.weaponId || tool.itemKey || tool.id || null,
    capabilities: Object.freeze([...capabilities]),
    combatProfileUnchanged: true,
  });
}

export function claimCanonicalCarcassProcessingAction({
  registry,
  carcass,
  processor,
  actionKey,
  actionToken,
  initiativeTurnId,
  generationId,
  authoritativeTurn = {},
} = {}) {
  const contract = CARCASS_PROCESSING_ACTIONS[actionKey];
  const processorId = idOf(processor);
  const record = { carcassId: carcass?.carcassId, sourceActorId: carcass?.sourceActorId, processorId, actionToken, initiativeTurnId, generationId };
  if (
    !carcass || !contract || !processorId || !actionToken || !initiativeTurnId || !generationId
    || carcass.state === "abandoned" || carcass.processingState === "fully-harvested" || carcass.processingFinalized
    || authoritativeTurn.actorId !== processorId
    || authoritativeTurn.actionToken !== actionToken
    || authoritativeTurn.initiativeTurnId !== initiativeTurnId
    || authoritativeTurn.generationId !== generationId
    || registry.actionClaims.has(actionToken)
    || registry.completedActionTokens.has(actionToken)
  ) return reject("stale-harvest-callback", record);
  const claim = {
    ...record, actionKey, resourceKey: contract.resourceKey,
    state: "claimed", completionCount: 0,
  };
  registry.actionClaims.set(actionToken, claim);
  carcass.processingOwnerToken = actionToken;
  return { accepted: true, claim: freeze(claim), contract, events: [event(`${actionKey}-requested`, claim)] };
}

const liveClaim = (registry, claim, allowedActions = []) => {
  const authoritative = registry?.actionClaims?.get(claim?.actionToken);
  return authoritative?.state === "claimed" && allowedActions.includes(authoritative.actionKey) ? authoritative : null;
};

export function completeCanonicalCarcassProcessingAction({ registry, claim } = {}) {
  const authoritative = liveClaim(registry, claim, Object.keys(CARCASS_PROCESSING_ACTIONS));
  if (!authoritative || registry.completedActionTokens.has(claim?.actionToken)) return reject("duplicate-processing-completion", claim, "duplicate-processing-completion");
  authoritative.state = "completed";
  authoritative.completionCount += 1;
  registry.completedActionTokens.add(authoritative.actionToken);
  return { accepted: true, claim: freeze(authoritative), events: [event("carcass-processing-action-completed", authoritative)] };
}

export function completeCanonicalFieldDressing({
  registry,
  claim,
  carcass,
  processor,
  tools = [],
  skillContext = {},
  environment = {},
} = {}) {
  const authoritative = liveClaim(registry, claim, ["field-dress-carcass"]);
  if (!authoritative || carcass?.processingOwnerToken !== authoritative.actionToken) return reject("stale-harvest-callback", claim);
  if (carcass.recoveryState !== "claimed" || carcass.claimantId !== idOf(processor)) return reject("harvest-before-recovery", authoritative);
  const profile = CANONICAL_HARVEST_PROFILES[carcass.sourceActorKey];
  if (!profile) return reject("harvest-profile-missing", authoritative);
  const toolProfiles = tools.map(classifyCanonicalProcessingTool);
  const hasTool = toolProfiles.some((tool) => tool.capabilities.some((capability) => profile.toolRequirements.fieldDressing.includes(capability)));
  const uncertainty = !hasTool
    || ["heavily-damaged", "mutilated"].includes(carcass.conditionProfile.bodyCondition)
    || carcass.conditionProfile.contaminationTags.length > 0
    || environment.processingConditions === "poor"
    || skillContext.experienced === false;
  if (!hasTool && skillContext.allowInadequateTools !== true) return reject("field-dressing-tool-required", authoritative, "field-dressing-rejected");
  const outcome = uncertainty ? (skillContext.outcome || "limited-success") : "success";
  if (outcome === "failure") {
    carcass.conditionProfile = freeze({
      ...carcass.conditionProfile,
      contaminationTags: Object.freeze([...new Set([...carcass.conditionProfile.contaminationTags, "gut-contamination"])]),
    });
  }
  carcass.processingState = "field-dressed";
  carcass.fieldDressed = true;
  carcass.harvestProfileKey = profile.profileKey;
  carcass.processingOwnerToken = null;
  return {
    accepted: true,
    outcome,
    rollRequired: uncertainty,
    carcass,
    toolProfiles,
    events: [
      event("field-dressing-requested", authoritative),
      event("field-dressing-completed", authoritative, { outcome, rollRequired: uncertainty }),
      event("harvest-profile-resolved", authoritative, { harvestProfileKey: profile.profileKey }),
    ],
  };
}

const blockedByCondition = (carcass, resourceEntry) => {
  const condition = carcass.conditionProfile || {};
  const locations = new Set((condition.lostLocations || []).map(text));
  if (resourceEntry.sourceLocations.some((location) => locations.has(text(location)))) return "source-location-destroyed";
  if (resourceEntry.resourceKey === "tusk" && locations.has("tusks")) return "tusk-missing";
  if (resourceEntry.resourceKey === "feather" && condition.burnExposure) return "feathers-fire-damaged";
  if (["meat", "fat"].includes(resourceEntry.resourceKey) && (condition.poisonExposure || condition.diseaseConcern)) return "food-safety-blocked";
  return null;
};

export function resolveHarvestYield({
  registry,
  claim,
  carcass,
  harvestProfile,
  processor,
  tools = [],
  skillContext = {},
  requestedResources = [],
  environment = {},
} = {}) {
  const allowed = Object.values(CARCASS_PROCESSING_ACTIONS).filter((entry) => entry.resourceKey).map((entry) => entry.key);
  const authoritative = liveClaim(registry, claim, allowed);
  if (!authoritative || carcass?.processingOwnerToken !== authoritative.actionToken) return reject("stale-harvest-callback", claim);
  if (carcass.claimantId !== idOf(processor) || !["field-dressed", "partially-harvested"].includes(carcass.processingState)) return reject("harvest-before-recovery", authoritative);
  if (!harvestProfile || harvestProfile.profileKey !== carcass.harvestProfileKey) return reject("harvest-profile-mismatch", authoritative);
  const contract = CARCASS_PROCESSING_ACTIONS[authoritative.actionKey];
  const toolProfiles = tools.map(classifyCanonicalProcessingTool);
  if (contract.toolCapability && !toolProfiles.some((tool) => tool.capabilities.includes(contract.toolCapability))) {
    return reject("harvest-tool-required", authoritative, "harvest-resource-unavailable");
  }
  const keys = requestedResources.length ? requestedResources : [authoritative.resourceKey];
  const resourceResults = [];
  const damagedResources = [];
  const unavailableResources = [];
  for (const resourceKey of keys) {
    const resourceEntry = harvestProfile.potentialResources.find((entry) => entry.resourceKey === resourceKey);
    const existing = carcass.remainingResources[resourceKey];
    if (!resourceEntry || existing?.state === "depleted" || existing?.harvestedQuantity > 0) {
      unavailableResources.push({ resourceKey, reason: existing ? `duplicate-${resourceKey}` : "resource-not-profiled" });
      continue;
    }
    const conditionReason = blockedByCondition(carcass, resourceEntry);
    const authorizedQuantity = Math.max(0, finite(resourceEntry.quantityAuthority.quantity));
    const quantity = conditionReason ? 0 : authorizedQuantity;
    const item = CANONICAL_HARVEST_RESOURCE_ITEMS[resourceKey];
    const ledger = {
      resourceKey,
      authorizedQuantity,
      harvestedQuantity: quantity,
      transferredQuantity: 0,
      remainingQuantity: quantity,
      unavailableQuantity: authorizedQuantity - quantity,
      state: quantity > 0 ? "harvested-awaiting-transfer" : "unavailable",
      lastMutationToken: authoritative.actionToken,
    };
    carcass.remainingResources[resourceKey] = ledger;
    if (conditionReason) {
      damagedResources.push({ resourceKey, reason: conditionReason });
      unavailableResources.push({ resourceKey, reason: conditionReason });
    } else {
      resourceResults.push(freeze({
        resourceKey,
        inventoryItemKey: item.inventoryItemKey,
        quantity,
        unitWeight: item.unitWeight,
        totalWeight: quantity * item.unitWeight,
        qualityClass: skillContext.qualityClass || (environment.processingConditions === "poor" ? "limited" : "ordinary"),
        source: freeze({ carcassId: carcass.carcassId, sourceActorId: carcass.sourceActorId, species: carcass.species }),
        valid: true,
      }));
    }
  }
  carcass.processingState = Object.values(carcass.remainingResources).some((entry) => entry.remainingQuantity > 0)
    ? "partially-harvested"
    : "field-dressed";
  carcass.processingOwnerToken = null;
  return {
    accepted: true,
    authorized: resourceResults.length > 0,
    resourceResults,
    damagedResources,
    unavailableResources,
    carcassNextState: carcass.processingState,
    timeClass: CARCASS_PROCESSING_ACTIONS[authoritative.actionKey].timeClass,
    reason: resourceResults.length ? null : "requested-resources-unavailable",
    toolProfiles,
    events: [
      event("harvest-yield-requested", authoritative, { requestedResources: keys }),
      ...unavailableResources.map((entry) => event("harvest-resource-unavailable", authoritative, entry)),
      event("harvest-yield-resolved", authoritative, { resourceCount: resourceResults.length }),
      event("carcass-resource-ledger-updated", authoritative, { resourceKeys: keys }),
    ],
  };
}

const stackInventory = (inventory, itemDefinition, quantity, source) => {
  const next = (inventory || []).map((item) => ({ ...item }));
  const existing = next.find((item) => item.itemKey === itemDefinition.itemKey && item.sourceCarcassId === source.carcassId);
  if (existing) {
    existing.quantity += quantity;
    existing.weight = existing.quantity * itemDefinition.unitWeight;
    return next;
  }
  next.push({
    ...itemDefinition,
    quantity,
    weight: quantity * itemDefinition.unitWeight,
    sourceCarcassId: source.carcassId,
    sourceActorId: source.sourceActorId,
    sourceSpeciesTags: [source.species].filter(Boolean),
  });
  return next;
};

export function requestHarvestInventoryTransfer({
  registry,
  processor,
  recipient,
  carcass,
  resources,
  inventory = recipient?.inventory || [],
  capacity = null,
  capacityAuthority = null,
  actionToken,
  generationId,
} = {}) {
  const processorId = idOf(processor);
  const recipientId = idOf(recipient);
  const record = { carcassId: carcass?.carcassId, sourceActorId: carcass?.sourceActorId, processorId, actionToken, generationId };
  if (!carcass || !processorId || !recipientId || !actionToken || !generationId || registry.completedTransferTokens.has(actionToken) || carcass.state === "abandoned" || carcass.processingFinalized) {
    return reject("stale-harvest-callback", record);
  }
  const encumbrance = resolveCapacity({ recipient, inventory, capacity, capacityAuthority });
  const availableCapacity = Math.max(0, finite(capacity, encumbrance.maxWeight) - encumbrance.currentWeight);
  let remainingCapacity = availableCapacity;
  let nextInventory = inventory.map((item) => ({ ...item }));
  const acceptedResources = [];
  const rejectedResources = [];
  for (const requested of resources || []) {
    const ledger = carcass.remainingResources[requested.resourceKey];
    const item = CANONICAL_HARVEST_RESOURCE_ITEMS[requested.resourceKey];
    if (!ledger || !item || ledger.remainingQuantity <= 0) {
      rejectedResources.push({ ...requested, reason: "resource-unavailable" });
      continue;
    }
    const requestedQuantity = Math.min(finite(requested.quantity, ledger.remainingQuantity), ledger.remainingQuantity);
    const legalQuantity = item.unitWeight > 0 ? Math.min(requestedQuantity, Math.floor((remainingCapacity + Number.EPSILON) / item.unitWeight)) : requestedQuantity;
    if (legalQuantity > 0) {
      const accepted = {
        resourceKey: requested.resourceKey,
        inventoryItemKey: item.inventoryItemKey,
        quantity: legalQuantity,
        unitWeight: item.unitWeight,
        totalWeight: legalQuantity * item.unitWeight,
      };
      acceptedResources.push(accepted);
      nextInventory = stackInventory(nextInventory, item, legalQuantity, { carcassId: carcass.carcassId, sourceActorId: carcass.sourceActorId, species: carcass.species });
      remainingCapacity -= accepted.totalWeight;
      ledger.transferredQuantity += legalQuantity;
      ledger.remainingQuantity -= legalQuantity;
      ledger.state = ledger.remainingQuantity > 0 ? "partially-transferred" : "transferred";
      ledger.lastTransferToken = actionToken;
    }
    if (legalQuantity < requestedQuantity) {
      rejectedResources.push({
        resourceKey: requested.resourceKey,
        inventoryItemKey: item.inventoryItemKey,
        quantity: requestedQuantity - legalQuantity,
        unitWeight: item.unitWeight,
        totalWeight: (requestedQuantity - legalQuantity) * item.unitWeight,
        reason: "capacity",
      });
    }
  }
  registry.completedTransferTokens.add(actionToken);
  const totalWeight = acceptedResources.reduce((sum, entry) => sum + entry.totalWeight, 0);
  const transferState = acceptedResources.length && rejectedResources.length
    ? "partial"
    : acceptedResources.length
      ? "completed"
      : "rejected";
  carcass.inventoryTransferState = freeze({
    actionToken,
    processorId,
    recipientId,
    acceptedResources: Object.freeze(acceptedResources),
    rejectedResources: Object.freeze(rejectedResources),
    totalWeight,
    availableCapacity,
    resultingCapacity: remainingCapacity,
    transferState,
  });
  return {
    accepted: acceptedResources.length > 0,
    acceptedResources,
    rejectedResources,
    totalWeight,
    availableCapacity,
    resultingCapacity: remainingCapacity,
    transferState,
    reason: acceptedResources.length ? null : "harvest-capacity-rejected",
    recipient: { ...recipient, inventory: nextInventory },
    carcass,
    events: [
      event("harvest-inventory-transfer-requested", record, { recipientId }),
      event(transferState === "partial" ? "harvest-inventory-transfer-partial" : acceptedResources.length ? "harvest-inventory-transfer-completed" : "harvest-capacity-rejected", record, {
        recipientId, totalWeight, transferState,
      }),
      event("carcass-resource-ledger-updated", record, { resourceKeys: resources.map((entry) => entry.resourceKey) }),
    ],
  };
}

export function createCanonicalProjectileRecoveryRecords({ carcass, projectiles = [] } = {}) {
  if (!carcass?.carcassId) return reject("carcass-missing", carcass);
  const records = projectiles.filter((projectile) => projectile.embedded === true && projectile.missed !== true).map((projectile) => ({
    projectileId: projectile.projectileId,
    ammunitionItemKey: projectile.ammunitionItemKey || "resource.recovered-arrow",
    sourceActorId: projectile.sourceActorId,
    sourceWeaponId: projectile.sourceWeaponId,
    carcassId: carcass.carcassId,
    hitLocation: projectile.hitLocation,
    embedded: true,
    damaged: projectile.damaged ?? "unknown",
    recoverable: projectile.recoverable ?? "pending",
    recoveredByActorId: null,
    state: "pending",
  }));
  carcass.projectileRecoveryRecords = records;
  return { accepted: true, records, groundProjectileState: projectiles.filter((entry) => entry.missed).map((entry) => ({
    projectileId: entry.projectileId,
    landingPosition: entry.landingPosition || null,
    recoverable: entry.recoverable ?? "unknown",
    recoveryPending: true,
    state: "terrain-search-deferred",
  })) };
}

export function recoverCanonicalEmbeddedProjectile({
  registry,
  carcass,
  projectileId,
  processor,
  actionToken,
  condition = "damaged",
} = {}) {
  const processorId = idOf(processor);
  const record = { carcassId: carcass?.carcassId, sourceActorId: carcass?.sourceActorId, processorId, actionToken };
  const projectile = carcass?.projectileRecoveryRecords?.find((entry) => entry.projectileId === projectileId);
  if (
    !projectile || carcass.recoveryState !== "claimed" || !processorId || !actionToken || carcass.processingFinalized
    || projectile.state !== "pending" || registry.completedProjectileIds.has(projectileId)
  ) return reject("duplicate-projectile-recovery", record, "projectile-recovery-rejected");
  projectile.damaged = condition !== "pristine";
  projectile.recoverable = true;
  projectile.recoveredByActorId = processorId;
  projectile.state = "recovered-awaiting-transfer";
  projectile.inventoryItemKey = condition === "pristine"
    ? CANONICAL_HARVEST_RESOURCE_ITEMS.recoveredArrow.inventoryItemKey
    : CANONICAL_HARVEST_RESOURCE_ITEMS.damagedArrow.inventoryItemKey;
  registry.completedProjectileIds.add(projectileId);
  return {
    accepted: true,
    projectile,
    events: [
      event("projectile-recovery-requested", record, { projectileId }),
      event("projectile-recovery-completed", record, { projectileId, condition }),
    ],
  };
}

export function requestRecoveredProjectileInventoryTransfer({
  registry,
  carcass,
  projectileId,
  recipient,
  inventory = recipient?.inventory || [],
  capacity = null,
  capacityAuthority = null,
  actionToken,
  generationId,
} = {}) {
  const projectile = carcass?.projectileRecoveryRecords?.find((entry) => entry.projectileId === projectileId);
  const recipientId = idOf(recipient);
  const record = { carcassId: carcass?.carcassId, sourceActorId: carcass?.sourceActorId, processorId: recipientId, actionToken, generationId };
  if (
    !projectile || projectile.state !== "recovered-awaiting-transfer" || !recipientId || carcass.processingFinalized
    || !actionToken || !generationId || registry.completedTransferTokens.has(actionToken)
  ) return reject("stale-harvest-callback", record);
  const item = projectile.damaged
    ? CANONICAL_HARVEST_RESOURCE_ITEMS.damagedArrow
    : CANONICAL_HARVEST_RESOURCE_ITEMS.recoveredArrow;
  const encumbrance = resolveCapacity({ recipient, inventory, capacity, capacityAuthority });
  const availableCapacity = Math.max(0, finite(capacity, encumbrance.maxWeight) - encumbrance.currentWeight);
  if (availableCapacity < item.unitWeight) {
    return {
      ...reject("harvest-capacity-rejected", record, "harvest-capacity-rejected"),
      projectile,
      recipient,
    };
  }
  const nextInventory = stackInventory(inventory, item, 1, { carcassId: carcass.carcassId, sourceActorId: carcass.sourceActorId, species: carcass.species });
  projectile.state = "transferred";
  projectile.transferActionToken = actionToken;
  registry.completedTransferTokens.add(actionToken);
  return {
    accepted: true,
    projectile,
    recipient: { ...recipient, inventory: nextInventory },
    totalWeight: item.unitWeight,
    events: [event("harvest-inventory-transfer-completed", record, {
      recipientId, projectileId, totalWeight: item.unitWeight,
    })],
  };
}

export function startCanonicalSpoilageBoundary({
  carcass,
  profileKey = "descriptive-freshness-boundary",
  startedAt,
  environmentClass = "unknown",
} = {}) {
  if (!carcass || carcass.spoilageState) return reject("spoilage-state-duplicate", carcass);
  const spoilageState = freeze({
    profileKey,
    startedAt,
    elapsedTime: 0,
    environmentClass,
    preservationState: "unpreserved",
    freshnessState: carcass.conditionProfile?.freshnessState || "unknown",
    nextEvaluationAt: null,
    state: "boundary-active",
    exactTemperatureCurve: null,
  });
  carcass.spoilageState = spoilageState;
  return { accepted: true, spoilageState, events: [event("spoilage-state-started", carcass, { environmentClass })] };
}

export function abandonCanonicalCarcass({ carcass, actorId, reason = "abandoned" } = {}) {
  if (!carcass || carcass.state === "abandoned" || carcass.processingState === "fully-harvested" || carcass.processingFinalized) return reject("post-processing-mutation", carcass);
  carcass.state = "abandoned";
  carcass.recoveryState = "abandoned";
  carcass.processingState = "destroyed";
  carcass.abandonmentReason = reason;
  return { accepted: true, carcass, events: [event("carcass-abandoned", carcass, { actorId, reason })] };
}

export function finalizeCanonicalCarcassProcessing({
  registry,
  carcass,
  outcome = "processing-completed",
  actionToken,
} = {}) {
  if (!carcass || !actionToken || registry.processingFinalizers.has(carcass.carcassId) || carcass.processingFinalized) {
    return reject("duplicate-processing-completion", carcass, "duplicate-processing-completion");
  }
  carcass.processingFinalized = true;
  carcass.processingOutcome = outcome;
  if (carcass.state !== "abandoned") {
    const remaining = Object.values(carcass.remainingResources || {}).some((entry) => entry.remainingQuantity > 0);
    carcass.processingState = remaining ? "partially-harvested" : "fully-harvested";
    carcass.state = "processing-completed";
  }
  registry.processingFinalizers.add(carcass.carcassId);
  return {
    accepted: true,
    carcass,
    events: [event("carcass-processing-completed", { ...carcass, actionToken }, { outcome })],
  };
}

export function getCanonicalCarcassProcessingPresentation({ carcass } = {}) {
  if (!carcass) return { visible: false };
  const ledger = Object.values(carcass.remainingResources || {});
  return freeze({
    visible: true,
    species: carcass.species,
    recoveryState: carcass.recoveryState,
    condition: carcass.conditionProfile?.bodyCondition || "unknown",
    claimant: carcass.carcassClaim?.claimantType || "unclaimed",
    fieldDressingState: carcass.fieldDressed ? "field dressed" : "pending",
    availableResources: Object.freeze(ledger.filter((entry) => entry.authorizedQuantity > 0).map((entry) => entry.resourceKey)),
    harvestedResources: Object.freeze(ledger.filter((entry) => entry.harvestedQuantity > 0).map((entry) => entry.resourceKey)),
    remainingResources: Object.freeze(ledger.filter((entry) => entry.remainingQuantity > 0).map((entry) => entry.resourceKey)),
    totalTransferWeight: carcass.inventoryTransferState?.totalWeight || 0,
    capacityWarning: carcass.inventoryTransferState?.rejectedResources?.length > 0,
    embeddedProjectileCount: (carcass.projectileRecoveryRecords || []).filter((entry) => entry.state === "pending").length,
    freshnessState: carcass.spoilageState?.freshnessState || carcass.conditionProfile?.freshnessState || "unknown",
    processingOutcome: carcass.processingOutcome || "pending",
    marker: "C",
  });
}

export function filterCanonicalCarcassProcessingAIActions({
  actor,
  carcass,
  actions = [],
  dangerPresent = false,
  inventoryCapacityReached = false,
  explicitGoal = null,
} = {}) {
  if (!actor || !carcass || actor.dead || actor.creatureType === "animal" || actor.companionProfile?.enabled) return [];
  if (carcass.processingFinalized || carcass.state === "abandoned") return [];
  return actions.filter((action) => {
    const key = action.key || action.id || action.type;
    if (dangerPresent) return key === "abandon-carcass";
    if (inventoryCapacityReached && key.startsWith("harvest-")) return false;
    if (explicitGoal === "meat" && ["recover-hide", "recover-tusks", "recover-claws", "recover-feathers"].includes(key)) return false;
    if (explicitGoal === "hide" && key === "harvest-meat") return false;
    return true;
  });
}

export function validateCanonicalCarcassProcessingState({ carcasses = [], sourceActors = [] } = {}) {
  const diagnostics = [];
  const actorById = new Map(sourceActors.map((actor) => [idOf(actor), actor]));
  for (const carcass of carcasses) {
    const sourceActor = actorById.get(carcass.sourceActorId);
    if (!(sourceActor?.dead || sourceActor?.isDead) || !carcass.deathEventId) diagnostics.push(event("carcass-without-death", carcass));
    if (sourceActor && !["animal"].includes(text(sourceActor.creatureType))) diagnostics.push(event("living-animal-harvest", carcass));
    if (carcass.processingFinalized && carcass.recoveryState === "unrecovered") diagnostics.push(event("harvest-before-recovery", carcass));
    if (
      ["companion-protected", "mount-protected"].includes(carcass.harvestEligibilityClassification)
      && Object.values(carcass.remainingResources || {}).some((entry) => entry.harvestedQuantity > 0)
    ) diagnostics.push(event(
      carcass.harvestEligibilityClassification === "mount-protected"
        ? "mount-harvest-unauthorized"
        : "companion-harvest-unauthorized",
      carcass,
    ));
    for (const ledger of Object.values(carcass.remainingResources || {})) {
      if (ledger.harvestedQuantity > ledger.authorizedQuantity || ledger.transferredQuantity > ledger.harvestedQuantity || ledger.remainingQuantity < 0) {
        diagnostics.push(event("resource-overharvest", carcass, { resourceKey: ledger.resourceKey }));
      }
    }
  }
  return { valid: diagnostics.length === 0, diagnostics };
}

export default {
  CANONICAL_HARVEST_PROFILES,
  CANONICAL_HARVEST_RESOURCE_ITEMS,
  CARCASS_PROCESSING_ACTIONS,
  abandonCanonicalCarcass,
  claimCanonicalCarcassProcessingAction,
  classifyCanonicalProcessingTool,
  completeCanonicalCarcassProcessingAction,
  completeCanonicalFieldDressing,
  createCanonicalCarcassProcessingRegistry,
  createCanonicalProcessingCarcass,
  createCanonicalProjectileRecoveryRecords,
  establishCanonicalCarcassClaim,
  finalizeCanonicalCarcassProcessing,
  filterCanonicalCarcassProcessingAIActions,
  getCanonicalCarcassProcessingPresentation,
  locateCanonicalCarcass,
  recoverCanonicalEmbeddedProjectile,
  recoverProcessingCarcass,
  requestHarvestInventoryTransfer,
  requestRecoveredProjectileInventoryTransfer,
  resolveCanonicalCarcassCondition,
  resolveCarcassHarvestEligibility,
  resolveHarvestYield,
  startCanonicalSpoilageBoundary,
  validateCanonicalCarcassProcessingState,
};
