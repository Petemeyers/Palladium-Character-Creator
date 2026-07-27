const idOf = (value) => value?.id ?? value?._id ?? null;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const text = (value) => String(value ?? "").trim().toLowerCase();
const freeze = (value) => Object.freeze({ ...value });
const clone = (value) => structuredClone(value);
const point = (value = {}) => freeze({
  x: finite(value.position?.x ?? value.x),
  y: finite(value.position?.y ?? value.y),
});
const distanceFeet = (left, right) => Math.hypot(
  finite(left?.x) - finite(right?.x),
  finite(left?.y) - finite(right?.y),
) * 5;
const event = (eventType, record = {}, data = {}) => ({
  eventType,
  actorId: data.actorId ?? record.actorId ?? null,
  targetId: data.targetId ?? record.foodId ?? record.heatSourceId ?? null,
  data: {
    generationId: record.generationId ?? null,
    initiativeTurnId: record.initiativeTurnId ?? null,
    actionToken: record.actionToken ?? null,
    contextId: record.contextId ?? null,
    foodId: record.foodId ?? null,
    heatSourceId: record.heatSourceId ?? null,
    ...data,
  },
});
const reject = (reason, record = {}, eventType = "stale-food-processing-callback-rejected", data = {}) => ({
  accepted: false,
  reason,
  events: [event(eventType, record, { reason, ...data })],
});
const authoritative = ({ actor, generationId, initiativeTurnId, actionToken, authoritativeTurn }) => (
  Boolean(idOf(actor) && generationId && initiativeTurnId && actionToken)
  && String(authoritativeTurn?.actorId) === String(idOf(actor))
  && String(authoritativeTurn?.generationId) === String(generationId)
  && String(authoritativeTurn?.initiativeTurnId) === String(initiativeTurnId)
  && String(authoritativeTurn?.actionToken) === String(actionToken)
);
const itemIdentity = (item = {}) => text(item.itemKey || item.inventoryItemKey || item.id || item.key);
const tagsOf = (item = {}) => new Set([
  ...(item.tags || []),
  ...(item.capabilities || []),
  item.type,
  item.category,
  item.itemKey,
  item.inventoryItemKey,
].filter(Boolean).map(text));
const hasTag = (item, tags) => {
  const present = tagsOf(item);
  return tags.some((tag) => present.has(text(tag)));
};
const inventoryQuantity = (item) => Math.max(0, finite(item?.quantity, 1));
const inventoryWeight = (inventory = []) => inventory.reduce(
  (sum, item) => sum + Math.max(0, finite(item?.weight, finite(item?.unitWeight) * inventoryQuantity(item))),
  0,
);
const capacitySnapshot = ({ recipient, inventory, capacity, capacityAuthority }) => {
  const authoritativeCapacity = typeof capacityAuthority === "function"
    ? capacityAuthority({ ...recipient, inventory })
    : null;
  return {
    currentWeight: authoritativeCapacity
      ? finite(authoritativeCapacity.currentWeight)
      : inventoryWeight(inventory),
    maxWeight: capacity == null
      ? finite(authoritativeCapacity?.maxWeight, finite(recipient?.carryWeight?.maxWeight))
      : finite(capacity),
    source: authoritativeCapacity ? "injected-existing-encumbrance-authority" : "explicit-capacity-snapshot",
  };
};
const consumeInventoryQuantity = (inventory, itemId, quantity, sourceCarcassId = null) => {
  let remaining = Math.max(0, finite(quantity));
  return inventory.flatMap((item) => {
    if (
      remaining <= 0
      || itemIdentity(item) !== itemId
      || (sourceCarcassId && item.sourceCarcassId !== sourceCarcassId)
    ) return [{ ...item }];
    const available = inventoryQuantity(item);
    const consumed = Math.min(available, remaining);
    remaining -= consumed;
    const nextQuantity = available - consumed;
    if (nextQuantity <= 0) return [];
    return [{
      ...item,
      quantity: nextQuantity,
      weight: finite(item.unitWeight) > 0 ? finite(item.unitWeight) * nextQuantity : finite(item.weight),
    }];
  });
};
const findInventoryItem = (inventory, identity) => (
  (inventory || []).find((item) => itemIdentity(item) === text(identity))
);
const freshnessRank = Object.freeze({ fresh: 0, aging: 1, questionable: 2, spoiled: 3 });
const processingFoodState = (method) => ({
  roast: "cooked",
  cook: "cooked",
  smoke: "smoked",
  dry: "dried",
  salt: "salted",
}[method] || "prepared");
const outputLabel = (food, method) => {
  const species = String(food.sourceSpecies || "Game").replaceAll("-", " ");
  return `${method === "roast" ? "Roasted" : method === "cook" ? "Cooked" : method === "smoke" ? "Smoked" : method === "dry" ? "Dried" : "Salted"} ${species} Meat`;
};

export const FOOD_PROCESSING_ACTIONS = Object.freeze({
  "build-fire": freeze({ key: "build-fire", label: "Build Fire", executor: "establishCanonicalHeatSource", actionCost: 1, delayed: false, aiAvailable: true }),
  "add-fuel": freeze({ key: "add-fuel", label: "Add Fuel", executor: "addCanonicalHeatSourceFuel", actionCost: 1, delayed: false, aiAvailable: true }),
  "extinguish-fire": freeze({ key: "extinguish-fire", label: "Extinguish Fire", executor: "extinguishCanonicalHeatSource", actionCost: 1, delayed: false, aiAvailable: true }),
  "prepare-food": freeze({ key: "prepare-food", label: "Prepare Food", executor: "startCanonicalFoodProcessing", actionCost: 1, delayed: false, aiAvailable: true }),
  "roast-meat": freeze({ key: "roast-meat", label: "Roast Meat", executor: "startCanonicalFoodProcessing", actionCost: 1, delayed: true, recipeKey: "roast-game-meat", aiAvailable: true }),
  "cook-food": freeze({ key: "cook-food", label: "Cook Food", executor: "startCanonicalFoodProcessing", actionCost: 1, delayed: true, recipeKey: "cook-game-meat-portions", aiAvailable: true }),
  "smoke-food": freeze({ key: "smoke-food", label: "Smoke Food", executor: "startCanonicalFoodProcessing", actionCost: 1, delayed: true, recipeKey: "smoke-game-meat", aiAvailable: true }),
  "dry-food": freeze({ key: "dry-food", label: "Dry Food", executor: "startCanonicalFoodProcessing", actionCost: 1, delayed: true, recipeKey: "dry-game-meat", aiAvailable: true }),
  "salt-food": freeze({ key: "salt-food", label: "Salt Food", executor: "startCanonicalFoodProcessing", actionCost: 1, delayed: true, recipeKey: "salt-game-meat", aiAvailable: true }),
  "inspect-food": freeze({ key: "inspect-food", label: "Inspect Food", executor: "inspectCanonicalFood", actionCost: 1, delayed: false, aiAvailable: true }),
  "consume-meal": freeze({ key: "consume-meal", label: "Consume Meal", executor: "consumeCanonicalMealPortion", actionCost: 1, delayed: false, aiAvailable: true }),
  "discard-food": freeze({ key: "discard-food", label: "Discard Food", executor: "discardCanonicalFood", actionCost: 1, delayed: false, aiAvailable: false }),
  "pack-food": freeze({ key: "pack-food", label: "Pack Food", executor: "retrieveCanonicalCampFood", actionCost: 1, delayed: false, aiAvailable: true }),
  "retrieve-food": freeze({ key: "retrieve-food", label: "Retrieve Food", executor: "retrieveCanonicalCampFood", actionCost: 1, delayed: false, aiAvailable: true }),
  "cancel-food-processing": freeze({ key: "cancel-food-processing", label: "Cancel Food Processing", executor: "cancelCanonicalFoodProcessing", actionCost: 0, delayed: false, aiAvailable: true }),
});

const recipe = (key, options) => freeze({
  key,
  inputCategory: "meat",
  inputQuantity: 1,
  outputQuantity: 1,
  portionCount: 2,
  durationClass: "short",
  uncertaintyClass: "routine",
  minimumHeatClass: "moderate",
  requiredToolCapabilities: Object.freeze([]),
  requiredIngredientKeys: Object.freeze([]),
  environmentRequirements: Object.freeze([]),
  skillRequirement: null,
  ...options,
});

export const CANONICAL_FOOD_RECIPES = Object.freeze({
  "roast-game-meat": recipe("roast-game-meat", {
    label: "Roast Meat",
    processingMethod: "roast",
    requiredToolCapabilities: Object.freeze(["cooking-support"]),
  }),
  "cook-game-meat-portions": recipe("cook-game-meat-portions", {
    label: "Cooked Meat Portions",
    processingMethod: "cook",
    requiredToolCapabilities: Object.freeze(["cooking-vessel"]),
    requiredIngredientKeys: Object.freeze(["resource.water"]),
  }),
  "smoke-game-meat": recipe("smoke-game-meat", {
    label: "Smoked Meat",
    processingMethod: "smoke",
    durationClass: "extended",
    minimumHeatClass: "low",
    requiredToolCapabilities: Object.freeze(["smoking-rack"]),
    environmentRequirements: Object.freeze(["protected-setup"]),
    preservationMethod: "smoked",
  }),
  "dry-game-meat": recipe("dry-game-meat", {
    label: "Dried Meat",
    processingMethod: "dry",
    durationClass: "extended",
    minimumHeatClass: "none",
    requiredToolCapabilities: Object.freeze(["drying-rack"]),
    environmentRequirements: Object.freeze(["dry-air"]),
    preservationMethod: "dried",
  }),
  "salt-game-meat": recipe("salt-game-meat", {
    label: "Salted Meat",
    processingMethod: "salt",
    durationClass: "moderate",
    minimumHeatClass: "none",
    requiredIngredientKeys: Object.freeze(["resource.salt"]),
    preservationMethod: "salted",
  }),
});

export function createCanonicalFoodProcessingRegistry() {
  return {
    foods: new Map(),
    heatSources: new Map(),
    contexts: new Map(),
    campCaches: new Map(),
    completedActionTokens: new Set(),
    completedMealTokens: new Set(),
    completedOutputContexts: new Set(),
    diagnostics: [],
  };
}

export function registerCanonicalHarvestedFoodResource({
  registry,
  item,
  owner,
  sourceCarcass = null,
  generationId,
  worldClock = 0,
  sequence = 1,
} = {}) {
  const ownerId = idOf(owner);
  const foodCapable = (
    item?.category === "food"
    && itemIdentity(item) === "resource.raw-game-meat"
    && item?.sourceCarcassId
  );
  if (!registry || !ownerId || !generationId || !foodCapable) {
    return reject("cooking-without-food-resource", { generationId, actorId: ownerId }, "food-resource-registration-rejected");
  }
  if (!sourceCarcass || (
    sourceCarcass.carcassId !== item.sourceCarcassId
    || sourceCarcass.recoveryState !== "claimed"
    || sourceCarcass.claimantId !== ownerId
  )) {
    return reject(
      sourceCarcass?.recoveryState !== "claimed" ? "cooking-without-claim" : "food-lineage-mismatch",
      { generationId, actorId: ownerId },
      "food-resource-registration-rejected",
    );
  }
  const sourceResourceId = item.id || `${item.sourceCarcassId}:${item.inventoryItemKey}`;
  const foodId = `${generationId}:food:${sourceResourceId}:${sequence}`;
  if (registry.foods.has(foodId)) return reject("duplicate-food-batch", { generationId, actorId: ownerId, foodId });
  const quantity = Math.max(0, inventoryQuantity(item));
  const food = {
    foodId,
    generationId,
    sourceResourceId,
    sourceCarcassId: item.sourceCarcassId,
    sourceActorId: item.sourceActorId || sourceCarcass?.sourceActorId || null,
    sourceSpecies: item.sourceSpeciesTags?.[0] || sourceCarcass?.species || "game",
    category: "meat",
    processingState: "raw",
    freshnessState: "fresh",
    contaminationState: sourceCarcass?.conditionProfile?.contaminationTags?.length ? "exposed" : "clean",
    quantity,
    quantityUnit: "unit",
    portionCount: quantity * 2,
    portionState: {
      batchId: `${foodId}:batch`,
      totalPortions: quantity * 2,
      consumedPortions: 0,
      remainingPortions: quantity * 2,
      discardedPortions: 0,
      portionClass: "meal",
      state: "available",
    },
    createdAtClock: finite(worldClock),
    lastProcessedAtClock: finite(worldClock),
    lastStorageEvaluationAtClock: finite(worldClock),
    storageContext: {
      locationType: "carried",
      temperatureClass: "temperate",
      moistureClass: "normal",
      exposureClass: "covered",
      containerId: null,
      location: point(owner),
    },
    preservationMethods: [],
    recipeKey: null,
    batchId: `${foodId}:batch`,
    processingOwner: null,
    resourceLedgerId: `${item.sourceCarcassId}:resource:meat`,
    ownerId,
    unitWeight: finite(item.unitWeight, 1),
    weight: finite(item.unitWeight, 1) * quantity,
    reservation: null,
    state: "available",
  };
  registry.foods.set(foodId, food);
  return {
    accepted: true,
    food,
    events: [
      event("food-resource-registered", { generationId, actorId: ownerId, foodId }, { sourceCarcassId: item.sourceCarcassId }),
      event("food-batch-created", { generationId, actorId: ownerId, foodId }, { batchId: food.batchId }),
    ],
  };
}

export function establishCanonicalHeatSource({
  registry,
  actor,
  generationId,
  initiativeTurnId,
  actionToken,
  authoritativeTurn,
  inventory = actor?.inventory || [],
  location = actor,
  environment = {},
  fuelItemId,
  ignitionItemId,
  heatSourceType = "campfire",
  worldClock = 0,
} = {}) {
  const actorId = idOf(actor);
  const record = { actorId, generationId, initiativeTurnId, actionToken };
  if (!authoritative({ actor, generationId, initiativeTurnId, actionToken, authoritativeTurn })) {
    return reject("stale-fire-callback", record, "stale-fire-callback-rejected");
  }
  if (registry.completedActionTokens.has(actionToken)) return reject("duplicate-fire-action", record, "stale-fire-callback-rejected");
  const terrain = text(environment.terrain);
  if (["water", "deep-water", "prohibited-fire"].includes(terrain) || environment.fireProhibited === true) {
    return reject("illegal-fire-location", record, "heat-source-ignition-failed");
  }
  const fuel = findInventoryItem(inventory, fuelItemId);
  const ignition = findInventoryItem(inventory, ignitionItemId);
  if (!fuel || !hasTag(fuel, ["fuel", "firewood", "charcoal"])) {
    return reject("missing-required-fuel", record, "heat-source-ignition-failed");
  }
  if (!ignition || !hasTag(ignition, ["ignition-source", "tinderbox", "flint-and-steel"])) {
    return reject("missing-ignition-source", record, "heat-source-ignition-failed");
  }
  const exposedRain = ["rain", "heavy-rain"].includes(text(environment.weather)) && environment.shelter !== true;
  if (exposedRain) return reject("exposed-rain-ignition-rejected", record, "heat-source-ignition-failed");
  const heatSourceId = `${generationId}:heat:${actorId}:${actionToken}`;
  const fuelId = itemIdentity(fuel);
  const ignitionId = itemIdentity(ignition);
  let nextInventory = consumeInventoryQuantity(inventory, fuelId, 1);
  nextInventory = consumeInventoryQuantity(nextInventory, ignitionId, ignition.consumable === true ? 1 : 0);
  const heatSource = {
    heatSourceId,
    generationId,
    type: heatSourceType,
    state: "burning",
    location: point(location),
    heatClass: heatSourceType === "smoking-fire" ? "low" : "moderate",
    fuelLedger: [{
      fuelItemId: fuelId,
      reservedQuantity: 1,
      consumedQuantity: 1,
      returnedQuantity: 0,
      actionToken,
      contextId: heatSourceId,
      state: "consumed",
    }],
    remainingFuelClass: "moderate",
    smokeClass: heatSourceType === "smoking-fire" ? "preservation-smoke" : "ordinary",
    shelterState: environment.shelter === true ? "sheltered" : "exposed",
    weatherExposure: text(environment.weather || "clear"),
    createdByActorId: actorId,
    createdByActionToken: actionToken,
    scheduleOwner: `${generationId}:${heatSourceId}`,
    stateVersion: 1,
    establishedAtClock: finite(worldClock),
    lastAdvancedAtClock: finite(worldClock),
  };
  registry.heatSources.set(heatSourceId, heatSource);
  registry.completedActionTokens.add(actionToken);
  return {
    accepted: true,
    heatSource,
    inventory: nextInventory,
    events: [
      event("heat-source-build-requested", record, { heatSourceId }),
      event("fuel-reserved", record, { heatSourceId, fuelItemId: fuelId, quantity: 1 }),
      event("fuel-consumed", record, { heatSourceId, fuelItemId: fuelId, quantity: 1 }),
      event("heat-source-established", record, { heatSourceId, heatClass: heatSource.heatClass }),
    ],
  };
}

export function advanceCanonicalHeatSource({
  registry,
  heatSourceId,
  generationId,
  expectedStateVersion,
  worldClock,
} = {}) {
  const heatSource = registry?.heatSources?.get(heatSourceId);
  if (
    !heatSource
    || String(heatSource.generationId) !== String(generationId)
    || finite(expectedStateVersion, heatSource.stateVersion) !== heatSource.stateVersion
  ) return reject("stale-fire-callback", { generationId, heatSourceId }, "stale-fire-callback-rejected");
  const elapsed = Math.max(0, finite(worldClock) - heatSource.lastAdvancedAtClock);
  if (heatSource.state === "burning" && elapsed >= 2) {
    heatSource.state = "embers";
    heatSource.heatClass = "low";
    heatSource.remainingFuelClass = "low";
  } else if (heatSource.state === "embers" && elapsed >= 2) {
    heatSource.state = "extinguished";
    heatSource.heatClass = "none";
    heatSource.remainingFuelClass = "none";
  }
  heatSource.lastAdvancedAtClock = finite(worldClock);
  heatSource.stateVersion += 1;
  return { accepted: true, heatSource, events: [event("heat-source-state-changed", heatSource, { state: heatSource.state })] };
}

export function extinguishCanonicalHeatSource({ registry, heatSourceId, actorId, generationId } = {}) {
  const heatSource = registry?.heatSources?.get(heatSourceId);
  if (!heatSource || String(heatSource.generationId) !== String(generationId)) {
    return reject("stale-fire-callback", { actorId, generationId, heatSourceId }, "stale-fire-callback-rejected");
  }
  heatSource.state = "extinguished";
  heatSource.heatClass = "none";
  heatSource.remainingFuelClass = "none";
  heatSource.stateVersion += 1;
  return { accepted: true, heatSource, events: [event("heat-source-state-changed", heatSource, { state: "extinguished" })] };
}

export function addCanonicalHeatSourceFuel({
  registry,
  heatSourceId,
  actor,
  generationId,
  actionToken,
  inventory = actor?.inventory || [],
  fuelItemId,
} = {}) {
  const heatSource = registry?.heatSources?.get(heatSourceId);
  const fuel = findInventoryItem(inventory, fuelItemId);
  const record = { actorId: idOf(actor), generationId, actionToken, heatSourceId };
  if (!heatSource || heatSource.state === "extinguished" || String(heatSource.generationId) !== String(generationId)) {
    return reject("stale-fire-callback", record, "stale-fire-callback-rejected");
  }
  if (!fuel || !hasTag(fuel, ["fuel", "firewood", "charcoal"])) return reject("missing-required-fuel", record, "fuel-reservation-rejected");
  if (registry.completedActionTokens.has(actionToken)) return reject("duplicate-fuel-consumption", record);
  const fuelId = itemIdentity(fuel);
  const nextInventory = consumeInventoryQuantity(inventory, fuelId, 1);
  heatSource.fuelLedger.push({
    fuelItemId: fuelId, reservedQuantity: 1, consumedQuantity: 1, returnedQuantity: 0,
    actionToken, contextId: heatSourceId, state: "consumed",
  });
  heatSource.state = "burning";
  heatSource.heatClass = heatSource.type === "smoking-fire" ? "low" : "moderate";
  heatSource.remainingFuelClass = "moderate";
  heatSource.stateVersion += 1;
  registry.completedActionTokens.add(actionToken);
  return {
    accepted: true,
    heatSource,
    inventory: nextInventory,
    events: [
      event("fuel-reserved", record, { fuelItemId: fuelId, quantity: 1 }),
      event("fuel-consumed", record, { fuelItemId: fuelId, quantity: 1 }),
      event("heat-source-state-changed", record, { state: "burning" }),
    ],
  };
}

export function validateCanonicalFoodRecipe({
  recipeKey,
  food,
  actor,
  heatSource = null,
  inventory = actor?.inventory || [],
  tools = inventory,
  environment = {},
} = {}) {
  const recipeDefinition = CANONICAL_FOOD_RECIPES[recipeKey];
  if (!recipeDefinition) return { accepted: false, reason: "unsupported-recipe" };
  if (!food || food.category !== recipeDefinition.inputCategory || food.state !== "available" || food.quantity < recipeDefinition.inputQuantity) {
    return { accepted: false, reason: "cooking-without-food-resource" };
  }
  if (food.freshnessState === "spoiled" || food.processingState === "spoiled") return { accepted: false, reason: "spoiled-food-cannot-be-processed" };
  if (food.reservation) return { accepted: false, reason: "food-already-reserved" };
  const requiresHeat = recipeDefinition.minimumHeatClass !== "none";
  if (requiresHeat && (!heatSource || !["burning", "embers"].includes(heatSource.state))) {
    return { accepted: false, reason: "cooking-without-heat" };
  }
  const heatRanks = { none: 0, low: 1, moderate: 2, high: 3 };
  if (requiresHeat && finite(heatRanks[heatSource.heatClass]) < finite(heatRanks[recipeDefinition.minimumHeatClass])) {
    return { accepted: false, reason: "incompatible-heat-class" };
  }
  if (requiresHeat && distanceFeet(point(actor), heatSource.location) > 10) return { accepted: false, reason: "distant-heat-source-use" };
  if (recipeDefinition.processingMethod === "smoke" && heatSource?.smokeClass !== "preservation-smoke") {
    return { accepted: false, reason: "smoking-without-smoke-capable-source" };
  }
  const availableCapabilities = new Set(tools.flatMap((tool) => [...tagsOf(tool)]));
  const missingTool = recipeDefinition.requiredToolCapabilities.find((capability) => !availableCapabilities.has(capability));
  if (missingTool) return { accepted: false, reason: "missing-required-tool", missingTool };
  const missingIngredient = recipeDefinition.requiredIngredientKeys.find((key) => !findInventoryItem(inventory, key));
  if (missingIngredient) return { accepted: false, reason: missingIngredient === "resource.salt" ? "salting-without-salt-inventory" : "missing-required-ingredient", missingIngredient };
  if (recipeDefinition.environmentRequirements.includes("protected-setup") && environment.shelter !== true) {
    return { accepted: false, reason: "missing-protected-setup" };
  }
  if (
    recipeDefinition.environmentRequirements.includes("dry-air")
    && (["rain", "heavy-rain"].includes(text(environment.weather)) || text(environment.humidity) === "wet")
  ) return { accepted: false, reason: "drying-in-illegal-environment" };
  if (recipeDefinition.skillRequirement && finite(actor?.skills?.Cooking) < recipeDefinition.skillRequirement) {
    return { accepted: false, reason: "cooking-skill-required" };
  }
  return { accepted: true, recipe: recipeDefinition };
}

export function startCanonicalFoodProcessing({
  registry,
  actor,
  foodId,
  recipeKey,
  heatSourceId = null,
  inventory = actor?.inventory || [],
  tools = inventory,
  environment = {},
  generationId,
  initiativeTurnId,
  actionToken,
  authoritativeTurn,
  worldClock = 0,
} = {}) {
  const actorId = idOf(actor);
  const record = { actorId, generationId, initiativeTurnId, actionToken, foodId, heatSourceId };
  if (!authoritative({ actor, generationId, initiativeTurnId, actionToken, authoritativeTurn })) {
    return reject("stale-food-processing-callback", record);
  }
  if (registry.completedActionTokens.has(actionToken)) return reject("duplicate-food-processing", record);
  const food = registry.foods.get(foodId);
  if (String(food?.generationId) !== String(generationId)) return reject("stale-food-processing-callback", record);
  const heatSource = heatSourceId ? registry.heatSources.get(heatSourceId) : null;
  const validation = validateCanonicalFoodRecipe({ recipeKey, food, actor, heatSource, inventory, tools, environment });
  if (!validation.accepted) return reject(validation.reason, record, "recipe-rejected", validation);
  const recipeDefinition = validation.recipe;
  const contextId = `${generationId}:food-process:${actorId}:${actionToken}`;
  const reservedIngredients = [{
    foodId,
    quantity: recipeDefinition.inputQuantity,
    state: "reserved",
  }];
  const reservedInventoryIngredients = recipeDefinition.requiredIngredientKeys.map((key) => ({
    itemId: key,
    quantity: 1,
    state: "reserved",
  }));
  const expectedCompletionClock = finite(worldClock) + (
    recipeDefinition.durationClass === "extended" ? 8
      : recipeDefinition.durationClass === "moderate" ? 2
        : 1
  );
  const context = {
    contextId,
    generationId,
    actorId,
    location: point(actor),
    environmentSnapshot: clone(environment),
    selectedFoodIds: [foodId],
    selectedRecipeKey: recipeKey,
    selectedHeatSourceId: heatSourceId,
    selectedFuelIds: [],
    selectedToolIds: tools.map(itemIdentity).filter(Boolean),
    initiativeTurnId,
    actionToken,
    scheduleOwner: `${generationId}:${contextId}`,
    reservedIngredients,
    reservedInventoryIngredients,
    reservedFuel: [],
    reservedTools: [...recipeDefinition.requiredToolCapabilities],
    startedAtClock: finite(worldClock),
    expectedCompletionClock,
    state: "processing",
    completionCount: 0,
    actorReleasedAfterSetup: recipeDefinition.durationClass === "extended",
  };
  food.reservation = { contextId, actionToken, quantity: recipeDefinition.inputQuantity, state: "reserved" };
  food.processingOwner = { contextId, actorId, actionToken, generationId };
  const reservedInventory = inventory.map((item) => (
    itemIdentity(item) === "resource.raw-game-meat" && item.sourceCarcassId === food.sourceCarcassId
      ? {
          ...item,
          foodReservation: {
            contextId,
            actionToken,
            foodId,
            quantity: recipeDefinition.inputQuantity,
            state: "reserved",
          },
        }
      : { ...item }
  ));
  registry.contexts.set(contextId, context);
  registry.completedActionTokens.add(actionToken);
  return {
    accepted: true,
    context,
    food,
    inventory: reservedInventory,
    events: [
      event("recipe-selected", record, { recipeKey }),
      event("food-processing-context-created", context),
      event("food-processing-validated", context),
      event("ingredient-reservation-created", context, { foodId, quantity: recipeDefinition.inputQuantity }),
      event("food-processing-started", context, { expectedCompletionClock }),
    ],
  };
}

export function completeCanonicalFoodProcessing({
  registry,
  contextId,
  generationId,
  worldClock,
  inventory = [],
  recipient = null,
  capacity = null,
  capacityAuthority = null,
  outcome = "success",
} = {}) {
  const context = registry?.contexts?.get(contextId);
  const record = context || { contextId, generationId };
  if (
    !context
    || String(context.generationId) !== String(generationId)
    || context.state !== "processing"
    || registry.completedOutputContexts.has(contextId)
  ) return reject("stale-food-processing-callback", record);
  if (finite(worldClock) < context.expectedCompletionClock) return reject("processing-interval-incomplete", record, "food-processing-interrupted");
  const recipeDefinition = CANONICAL_FOOD_RECIPES[context.selectedRecipeKey];
  const input = registry.foods.get(context.selectedFoodIds[0]);
  if (!input || input.reservation?.contextId !== contextId) return reject("reservation-leak", record);
  const heatSource = context.selectedHeatSourceId ? registry.heatSources.get(context.selectedHeatSourceId) : null;
  if (
    recipeDefinition.minimumHeatClass !== "none"
    && (!heatSource || !["burning", "embers"].includes(heatSource.state))
  ) {
    context.state = "interrupted";
    input.reservation = null;
    input.processingOwner = null;
    return {
      accepted: false,
      reason: "heat-source-lost",
      context,
      events: [
        event("food-processing-interrupted", context, { reason: "heat-source-lost" }),
        event("ingredient-reservation-released", context, { foodId: input.foodId }),
      ],
    };
  }
  const consumedQuantity = recipeDefinition.inputQuantity;
  input.quantity = Math.max(0, input.quantity - consumedQuantity);
  input.portionState.totalPortions = input.quantity * 2;
  input.portionState.remainingPortions = Math.max(0, input.portionState.totalPortions - input.portionState.consumedPortions);
  input.portionCount = input.portionState.remainingPortions;
  input.reservation = null;
  input.processingOwner = null;
  input.state = input.quantity > 0 ? "available" : "consumed";
  let nextInventory = clone(inventory);
  nextInventory = consumeInventoryQuantity(
    nextInventory,
    "resource.raw-game-meat",
    consumedQuantity,
    input.sourceCarcassId,
  );
  nextInventory = nextInventory.map((item) => (
    item.foodReservation?.contextId === contextId
      ? Object.fromEntries(Object.entries(item).filter(([key]) => key !== "foodReservation"))
      : item
  ));
  for (const reservation of context.reservedInventoryIngredients) {
    nextInventory = consumeInventoryQuantity(nextInventory, reservation.itemId, reservation.quantity);
    reservation.state = "consumed";
  }
  const processingState = outcome === "burned" ? "burned" : outcome === "undercooked" ? "prepared" : processingFoodState(recipeDefinition.processingMethod);
  const outputFoodId = `${input.foodId}:output:${context.selectedRecipeKey}`;
  const output = {
    ...clone(input),
    foodId: outputFoodId,
    sourceResourceId: input.sourceResourceId,
    sourceFoodId: input.foodId,
    processingState,
    freshnessState: input.freshnessState,
    quantity: recipeDefinition.outputQuantity,
    portionCount: recipeDefinition.portionCount,
    portionState: {
      batchId: input.batchId,
      totalPortions: recipeDefinition.portionCount,
      consumedPortions: 0,
      remainingPortions: recipeDefinition.portionCount,
      discardedPortions: 0,
      portionClass: "meal",
      state: "available",
    },
    lastProcessedAtClock: finite(worldClock),
    lastStorageEvaluationAtClock: finite(worldClock),
    preservationMethods: recipeDefinition.preservationMethod
      ? [...new Set([...input.preservationMethods, recipeDefinition.preservationMethod])]
      : [...input.preservationMethods],
    recipeKey: context.selectedRecipeKey,
    batchId: input.batchId,
    processingOwner: null,
    reservation: null,
    state: "available",
    name: outputLabel(input, recipeDefinition.processingMethod),
    type: "canonical-food",
    category: "food",
    inventoryItemKey: `food.${processingState}.${input.sourceSpecies || "game"}-meat`,
    unitWeight: input.unitWeight,
    weight: input.unitWeight * recipeDefinition.outputQuantity,
  };
  const encumbrance = capacitySnapshot({ recipient, inventory: nextInventory, capacity, capacityAuthority });
  const fits = encumbrance.maxWeight <= 0 || encumbrance.currentWeight + output.weight <= encumbrance.maxWeight;
  let outputLocation = "inventory";
  let campCache = null;
  if (fits) {
    nextInventory = nextInventory.concat(clone(output));
  } else {
    outputLocation = "camp-cache";
    const cacheId = `${context.generationId}:camp-cache:${context.contextId}`;
    campCache = {
      cacheId,
      generationId: context.generationId,
      location: clone(context.location),
      foodIds: [outputFoodId],
      state: "active",
    };
    registry.campCaches.set(cacheId, campCache);
    output.storageContext = {
      ...output.storageContext,
      locationType: "camp-cache",
      location: clone(context.location),
      containerId: cacheId,
    };
  }
  registry.foods.set(outputFoodId, output);
  context.state = "completed";
  context.completionCount = 1;
  context.outputFoodId = outputFoodId;
  context.outputLocation = outputLocation;
  registry.completedOutputContexts.add(contextId);
  return {
    accepted: true,
    context,
    input,
    output,
    outputLocation,
    inventory: nextInventory,
    campCache,
    events: [
      event("ingredient-consumed", context, { foodId: input.foodId, quantity: consumedQuantity }),
      ...context.reservedInventoryIngredients.map((entry) => event("ingredient-consumed", context, { itemId: entry.itemId, quantity: entry.quantity })),
      event("food-output-committed", context, { foodId: outputFoodId, outputLocation }),
      event("food-processing-completed", context, { foodId: outputFoodId, outcome: processingState }),
      event("food-resource-ledger-audited", context, { consumedQuantity, outputQuantity: output.quantity }),
    ],
  };
}

export function cancelCanonicalFoodProcessing({
  registry,
  contextId,
  generationId,
  reason = "canceled",
  inventory = [],
} = {}) {
  const context = registry?.contexts?.get(contextId);
  if (!context || String(context.generationId) !== String(generationId) || context.state !== "processing") {
    return reject("stale-food-processing-callback", context || { contextId, generationId });
  }
  const food = registry.foods.get(context.selectedFoodIds[0]);
  if (food?.reservation?.contextId === contextId) {
    food.reservation = null;
    food.processingOwner = null;
  }
  context.reservedIngredients.forEach((entry) => { entry.state = "released"; });
  context.reservedInventoryIngredients.forEach((entry) => { entry.state = "released"; });
  context.state = "canceled";
  return {
    accepted: true,
    context,
    inventory: inventory.map((item) => (
      item.foodReservation?.contextId === contextId
        ? Object.fromEntries(Object.entries(item).filter(([key]) => key !== "foodReservation"))
        : { ...item }
    )),
    events: [
      event("food-processing-canceled", context, { reason }),
      event("ingredient-reservation-released", context, { foodId: food?.foodId }),
    ],
  };
}

export function evaluateCanonicalFoodFreshness({
  registry,
  foodId,
  generationId,
  worldClock,
  storageContext = null,
} = {}) {
  const food = registry?.foods?.get(foodId);
  if (!food || !generationId || String(food.generationId) !== String(generationId) || food.state === "discarded") {
    return reject("stale-freshness-callback", { foodId, generationId }, "stale-freshness-callback-rejected");
  }
  const storage = storageContext || food.storageContext || {};
  const elapsed = Math.max(0, finite(worldClock) - finite(food.createdAtClock));
  const temperatureFactor = { cold: 0.6, cool: 0.75, temperate: 1, warm: 1.5, hot: 2 }[text(storage.temperatureClass)] || 1;
  const exposureFactor = { sealed: 0.75, covered: 1, exposed: 1.35 }[text(storage.exposureClass)] || 1;
  const moistureFactor = { dry: 0.85, normal: 1, wet: 1.4 }[text(storage.moistureClass)] || 1;
  const contaminationFactor = food.contaminationState === "contaminated" ? 1.5 : food.contaminationState === "exposed" ? 1.15 : 1;
  const preservationFactor = food.preservationMethods.includes("dried") ? 0.4
    : food.preservationMethods.includes("smoked") ? 0.5
      : food.preservationMethods.includes("salted") ? 0.55
        : food.processingState === "cooked" ? 0.8
          : 1;
  const effectiveElapsed = elapsed * temperatureFactor * exposureFactor * moistureFactor * contaminationFactor * preservationFactor;
  const nextFreshness = effectiveElapsed >= 48 ? "spoiled"
    : effectiveElapsed >= 30 ? "questionable"
      : effectiveElapsed >= 12 ? "aging"
        : "fresh";
  const currentRank = freshnessRank[food.freshnessState] ?? 0;
  const nextRank = Math.max(currentRank, freshnessRank[nextFreshness]);
  const resolved = Object.keys(freshnessRank).find((key) => freshnessRank[key] === nextRank) || "spoiled";
  const changed = resolved !== food.freshnessState;
  food.freshnessState = resolved;
  if (resolved === "spoiled") food.processingState = "spoiled";
  food.lastStorageEvaluationAtClock = finite(worldClock);
  food.storageContext = clone(storage);
  return {
    accepted: true,
    food,
    effectiveElapsed,
    events: [
      event("food-freshness-evaluated", { generationId, foodId }, { worldClock, effectiveElapsed, freshnessState: resolved }),
      ...(changed ? [event("food-freshness-changed", { generationId, foodId }, { freshnessState: resolved })] : []),
      event("food-contamination-evaluated", { generationId, foodId }, { contaminationState: food.contaminationState }),
    ],
  };
}

export function inspectCanonicalFood({ registry, foodId, actorId, generationId } = {}) {
  const food = registry?.foods?.get(foodId);
  if (!food || food.state === "discarded") return reject("food-unavailable", { actorId, generationId, foodId }, "food-inspection-rejected");
  const risk = food.freshnessState === "spoiled" ? "unsafe"
    : food.freshnessState === "questionable" ? "warning"
      : food.contaminationState === "contaminated" ? "warning"
        : "ordinary";
  return {
    accepted: true,
    food,
    inspection: {
      risk,
      freshnessState: food.freshnessState,
      contaminationState: food.contaminationState,
      processingState: food.processingState,
      remainingPortions: food.portionState.remainingPortions,
    },
    events: [event("food-inspection-resolved", { actorId, generationId, foodId }, { risk })],
  };
}

export function consumeCanonicalMealPortion({
  registry,
  actor,
  foodId,
  generationId,
  initiativeTurnId,
  actionToken,
  authoritativeTurn,
  inventoryAccess = true,
  confirmSpoiled = false,
  worldClock = 0,
  immediateExertion = false,
  inventory = actor?.inventory || [],
} = {}) {
  const actorId = idOf(actor);
  const record = { actorId, generationId, initiativeTurnId, actionToken, foodId };
  if (!authoritative({ actor, generationId, initiativeTurnId, actionToken, authoritativeTurn })) return reject("stale-meal-callback", record);
  if (registry.completedMealTokens.has(actionToken)) return reject("duplicate-meal-result", record);
  const food = registry.foods.get(foodId);
  if (String(food?.generationId) !== String(generationId)) return reject("stale-meal-callback", record);
  if (!food || food.state !== "available" || food.reservation || food.portionState.remainingPortions <= 0) return reject("meal-without-portion", record);
  if (actor.dead || actor.isDead) return reject("dead-actor-cannot-eat", record);
  if (actor.unconscious || actor.isUnconscious) return reject("unconscious-actor-cannot-eat", record);
  if (!inventoryAccess) return reject("food-inventory-access-required", record);
  if (food.freshnessState === "spoiled" && !confirmSpoiled) {
    return reject("spoiled-food-confirmation-required", record, "meal-consumption-warning");
  }
  food.portionState.consumedPortions += 1;
  food.portionState.remainingPortions -= 1;
  food.portionCount = food.portionState.remainingPortions;
  if (food.portionState.remainingPortions === 0) {
    food.portionState.state = "consumed";
    food.state = "consumed";
  }
  const currentStamina = finite(actor.currentStamina ?? actor.stamina);
  const maximumStamina = finite(actor.maxStamina ?? actor.staminaMaximum, currentStamina);
  const staminaRecovery = immediateExertion || food.freshnessState === "spoiled"
    ? 0
    : Math.max(0, Math.min(2, maximumStamina - currentStamina));
  const adverseRisk = food.freshnessState === "spoiled"
    ? "spoiled-food-risk"
    : food.freshnessState === "questionable" || food.contaminationState === "contaminated"
      ? "food-condition-risk"
      : "none";
  const nourishmentState = {
    status: adverseRisk === "none" ? "fed" : "adequate",
    lastMealAtClock: finite(worldClock),
    sourceFoodId: foodId,
    updateCount: finite(actor.nourishmentState?.updateCount) + 1,
  };
  const actorPatch = {
    currentHP: actor.currentHP,
    hp: actor.hp,
    currentStamina: currentStamina + staminaRecovery,
    stamina: actor.stamina == null ? actor.stamina : currentStamina + staminaRecovery,
    nourishmentState,
  };
  const mealResult = {
    foodId,
    portionId: `${food.batchId}:portion:${food.portionState.consumedPortions}`,
    hungerChange: adverseRisk === "none" ? -1 : 0,
    staminaRecovery,
    moraleChange: adverseRisk === "none" ? 1 : 0,
    restModifier: adverseRisk === "none" ? 1 : 0,
    adverseRisk,
    appliedAtClock: finite(worldClock),
    state: "applied",
    hpHealing: 0,
    clearedInjuries: [],
  };
  registry.completedMealTokens.add(actionToken);
  const nextInventory = inventory.flatMap((item) => {
    if (item.foodId !== foodId) return [{ ...item }];
    if (food.portionState.remainingPortions <= 0) return [];
    return [{
      ...item,
      portionCount: food.portionCount,
      portionState: clone(food.portionState),
    }];
  });
  return {
    accepted: true,
    food,
    actorPatch,
    mealResult,
    inventory: nextInventory,
    events: [
      event("meal-consumption-requested", record),
      event("meal-portion-consumed", record, { portionId: mealResult.portionId }),
      event("meal-result-applied", record, { staminaRecovery, adverseRisk, hpHealing: 0 }),
      event("food-resource-ledger-audited", record, { ...food.portionState }),
    ],
  };
}

export function discardCanonicalFood({ registry, foodId, actorId, generationId, inventory = [] } = {}) {
  const food = registry?.foods?.get(foodId);
  if (!food || food.state !== "available" || food.reservation) return reject("food-discard-rejected", { actorId, generationId, foodId });
  food.portionState.discardedPortions += food.portionState.remainingPortions;
  food.portionState.remainingPortions = 0;
  food.portionState.state = "discarded";
  food.portionCount = 0;
  food.quantity = 0;
  food.state = "discarded";
  return {
    accepted: true,
    food,
    inventory: inventory.filter((item) => item.foodId !== foodId).map((item) => ({ ...item })),
    events: [event("food-discarded", { actorId, generationId, foodId })],
  };
}

export function retrieveCanonicalCampFood({
  registry,
  cacheId,
  foodId,
  actor,
  generationId,
  inventory = actor?.inventory || [],
  capacity = null,
  capacityAuthority = null,
} = {}) {
  const cache = registry?.campCaches?.get(cacheId);
  const food = registry?.foods?.get(foodId);
  const record = { actorId: idOf(actor), generationId, foodId };
  if (!cache || !food || cache.state !== "active" || String(cache.generationId) !== String(generationId)) return reject("camp-cache-access-rejected", record);
  if (distanceFeet(point(actor), cache.location) > 10) return reject("camp-cache-location-access-required", record);
  const encumbrance = capacitySnapshot({ recipient: actor, inventory, capacity, capacityAuthority });
  if (encumbrance.maxWeight > 0 && encumbrance.currentWeight + food.weight > encumbrance.maxWeight) return reject("output-lost-to-capacity", record, "harvest-capacity-rejected");
  cache.foodIds = cache.foodIds.filter((id) => id !== foodId);
  if (!cache.foodIds.length) cache.state = "empty";
  food.storageContext = { ...food.storageContext, locationType: "carried", containerId: null, location: point(actor) };
  return {
    accepted: true,
    food,
    inventory: [...clone(inventory), clone(food)],
    events: [event("food-storage-context-changed", record, { locationType: "carried" })],
  };
}

export function filterCanonicalFoodProcessingAIActions({
  actor,
  actions = [],
  immediateCombatActive = false,
  urgentThreat = false,
  rawFoodAvailable = false,
  cookedFoodAvailable = false,
  safeCamp = false,
  heatAvailable = false,
  preservationSetup = false,
} = {}) {
  if (!actor || actor.dead || actor.unconscious || immediateCombatActive || urgentThreat) return [];
  return actions.filter((action) => {
    const key = action.key || action.id || action.type;
    if (key === "consume-meal") return cookedFoodAvailable && ["hungry", "starving"].includes(actor.nourishmentState?.status);
    if (["roast-meat", "cook-food"].includes(key)) return rawFoodAvailable && safeCamp && heatAvailable;
    if (["smoke-food", "dry-food"].includes(key)) return rawFoodAvailable && safeCamp && preservationSetup;
    if (key === "cancel-food-processing") return urgentThreat;
    return ["inspect-food", "build-fire", "add-fuel", "extinguish-fire"].includes(key);
  });
}

export function validateCanonicalFoodProcessingState({
  foods = [],
  heatSources = [],
  contexts = [],
  mealResults = [],
} = {}) {
  const diagnostics = [];
  const outputSources = new Set();
  for (const food of foods) {
    if (!food.foodId) diagnostics.push(event("food-without-stable-id", food));
    if (!food.batchId) diagnostics.push(event("food-without-batch-id", food));
    if (finite(food.quantity) < 0) diagnostics.push(event("negative-food-quantity", food));
    if (
      finite(food.portionState?.totalPortions)
      !== finite(food.portionState?.consumedPortions) + finite(food.portionState?.remainingPortions) + finite(food.portionState?.discardedPortions)
    ) diagnostics.push(event("portion-ledger-mismatch", food));
    if (food.processingState === "cooked" && !food.sourceFoodId) diagnostics.push(event("cooked-item-without-source-lineage", food));
    if (food.freshnessState === "fresh" && food.processingState === "spoiled") diagnostics.push(event("spoiled-food-restored", food));
    if (food.sourceFoodId) {
      const key = `${food.sourceFoodId}:${food.recipeKey}`;
      if (outputSources.has(key)) diagnostics.push(event("duplicate-food-output", food));
      outputSources.add(key);
    }
    if (new Set(food.preservationMethods || []).size !== (food.preservationMethods || []).length) {
      diagnostics.push(event("preservation-stacked-illegally", food));
    }
  }
  for (const heatSource of heatSources) {
    for (const ledger of heatSource.fuelLedger || []) {
      if (ledger.consumedQuantity + ledger.returnedQuantity !== ledger.reservedQuantity) diagnostics.push(event("fuel-ledger-mismatch", heatSource));
    }
  }
  for (const context of contexts) {
    if (context.state === "canceled" && context.reservedIngredients.some((entry) => entry.state === "reserved")) diagnostics.push(event("canceled-reservation-retained", context));
    if (context.state === "completed" && context.completionCount !== 1) diagnostics.push(event("duplicate completion", context));
  }
  for (const result of mealResults) {
    if (result.hpHealing > 0) diagnostics.push(event("meal-direct-hp-heal", result));
    if (result.clearedInjuries?.length) diagnostics.push(event("meal-cleared-injury", result));
  }
  return { valid: diagnostics.length === 0, diagnostics };
}

export function getCanonicalFoodProcessingPresentation({ foods = [], heatSources = [], contexts = [] } = {}) {
  const activeFoods = foods.filter((food) => !["consumed", "discarded"].includes(food.state));
  const activeHeat = heatSources.find((heatSource) => ["burning", "embers"].includes(heatSource.state));
  const activeContext = contexts.find((context) => context.state === "processing");
  return {
    visible: Boolean(activeFoods.length || activeHeat || activeContext),
    ariaLabel: "Canonical food processing",
    foodCount: activeFoods.length,
    portions: activeFoods.reduce((sum, food) => sum + finite(food.portionState?.remainingPortions), 0),
    freshnessStates: [...new Set(activeFoods.map((food) => food.freshnessState))],
    heatSourceState: activeHeat?.state || "none",
    heatClass: activeHeat?.heatClass || "none",
    fuelState: activeHeat?.remainingFuelClass || "none",
    selectedRecipe: activeContext?.selectedRecipeKey || null,
    processingState: activeContext?.state || "idle",
  };
}

export default {
  CANONICAL_FOOD_RECIPES,
  FOOD_PROCESSING_ACTIONS,
  addCanonicalHeatSourceFuel,
  advanceCanonicalHeatSource,
  cancelCanonicalFoodProcessing,
  completeCanonicalFoodProcessing,
  consumeCanonicalMealPortion,
  createCanonicalFoodProcessingRegistry,
  discardCanonicalFood,
  establishCanonicalHeatSource,
  evaluateCanonicalFoodFreshness,
  extinguishCanonicalHeatSource,
  filterCanonicalFoodProcessingAIActions,
  getCanonicalFoodProcessingPresentation,
  inspectCanonicalFood,
  registerCanonicalHarvestedFoodResource,
  retrieveCanonicalCampFood,
  startCanonicalFoodProcessing,
  validateCanonicalFoodProcessingState,
  validateCanonicalFoodRecipe,
};
