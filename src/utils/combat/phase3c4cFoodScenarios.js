import { runRecoveredBoarProcessingScenario } from "./phase3c4bCarcassScenarios.js";
import {
  cancelCanonicalFoodProcessing,
  completeCanonicalFoodProcessing,
  consumeCanonicalMealPortion,
  createCanonicalFoodProcessingRegistry,
  establishCanonicalHeatSource,
  evaluateCanonicalFoodFreshness,
  extinguishCanonicalHeatSource,
  inspectCanonicalFood,
  registerCanonicalHarvestedFoodResource,
  startCanonicalFoodProcessing,
  validateCanonicalFoodProcessingState,
} from "./canonicalFoodProcessing.js";

const turn = (actorId, generationId, initiativeTurnId, actionToken) => ({
  actorId, generationId, initiativeTurnId, actionToken,
});
const collect = (events, result) => {
  events.push(...(result?.events || []));
  return result;
};
const inventoryFixtures = () => ([
  { id: "raw-meat-stack", itemKey: "resource.raw-game-meat", inventoryItemKey: "resource.raw-game-meat", name: "Raw Game Meat", category: "food", type: "harvest-resource", quantity: 3, unitWeight: 1, weight: 3, sourceCarcassId: "scenario-carcass", sourceActorId: "scenario-boar", sourceSpeciesTags: ["boar"] },
  { id: "fuel-stack", itemKey: "resource.firewood", name: "Firewood", type: "fuel", tags: ["fuel", "firewood"], quantity: 3, unitWeight: 1, weight: 3 },
  { id: "ignition", itemKey: "tool.flint-and-steel", name: "Flint and Steel", type: "tool", tags: ["ignition-source", "flint-and-steel"], quantity: 1, weight: 0.5 },
  { id: "spit", itemKey: "tool.cooking-spit", name: "Cooking Spit", type: "tool", tags: ["cooking-support"], quantity: 1, weight: 1 },
  { id: "pot", itemKey: "tool.cooking-pot", name: "Cooking Pot", type: "tool", tags: ["cooking-vessel"], quantity: 1, weight: 2 },
  { id: "smoking-rack", itemKey: "tool.smoking-rack", name: "Smoking Rack", type: "tool", tags: ["smoking-rack"], quantity: 1, weight: 3 },
  { id: "drying-rack", itemKey: "tool.drying-rack", name: "Drying Rack", type: "tool", tags: ["drying-rack"], quantity: 1, weight: 2 },
  { id: "water", itemKey: "resource.water", name: "Water", type: "ingredient", quantity: 2, unitWeight: 1, weight: 2 },
]);

const createFixture = ({ generationId, heatSourceType = "campfire", environment = { terrain: "camp", shelter: true, weather: "clear" } } = {}) => {
  const events = [];
  const registry = createCanonicalFoodProcessingRegistry();
  const actor = {
    id: `${generationId}:hunter`,
    name: "Longbowman",
    position: { x: 0, y: 0 },
    x: 0,
    y: 0,
    currentHP: 14,
    hp: 14,
    currentStamina: 8,
    stamina: 8,
    maxStamina: 12,
    staminaMaximum: 12,
    remainingActions: 2,
    nourishmentState: { status: "hungry", updateCount: 0 },
  };
  let inventory = inventoryFixtures();
  inventory[0].sourceCarcassId = `${generationId}:carcass`;
  inventory[0].sourceActorId = `${generationId}:boar`;
  const carcass = {
    carcassId: `${generationId}:carcass`,
    sourceActorId: `${generationId}:boar`,
    species: "boar",
    recoveryState: "claimed",
    claimantId: actor.id,
    conditionProfile: { contaminationTags: [] },
  };
  const registered = collect(events, registerCanonicalHarvestedFoodResource({
    registry,
    item: inventory[0],
    owner: actor,
    sourceCarcass: carcass,
    generationId,
    worldClock: 0,
  }));
  const fireTurnId = `${generationId}:turn:fire`;
  const fireToken = `${fireTurnId}:1`;
  const fire = collect(events, establishCanonicalHeatSource({
    registry,
    actor: { ...actor, inventory },
    generationId,
    initiativeTurnId: fireTurnId,
    actionToken: fireToken,
    authoritativeTurn: turn(actor.id, generationId, fireTurnId, fireToken),
    inventory,
    location: actor.position,
    environment,
    fuelItemId: "resource.firewood",
    ignitionItemId: "tool.flint-and-steel",
    heatSourceType,
    worldClock: 0,
  }));
  if (fire.accepted) inventory = fire.inventory;
  return { generationId, registry, actor, carcass, inventory, events, registered, fire, environment };
};

const start = (fixture, {
  recipeKey = "roast-game-meat",
  sequence = 2,
  environment = fixture.environment,
  tools = fixture.inventory,
} = {}) => {
  const initiativeTurnId = `${fixture.generationId}:turn:${sequence}`;
  const actionToken = `${initiativeTurnId}:1`;
  const result = collect(fixture.events, startCanonicalFoodProcessing({
    registry: fixture.registry,
    actor: { ...fixture.actor, inventory: fixture.inventory },
    foodId: fixture.registered.food?.foodId,
    recipeKey,
    heatSourceId: fixture.fire.heatSource?.heatSourceId,
    inventory: fixture.inventory,
    tools,
    environment,
    generationId: fixture.generationId,
    initiativeTurnId,
    actionToken,
    authoritativeTurn: turn(fixture.actor.id, fixture.generationId, initiativeTurnId, actionToken),
    worldClock: 0,
  }));
  if (result.accepted) fixture.inventory = result.inventory;
  return result;
};

const finish = (fixture, processing, options = {}) => {
  const result = collect(fixture.events, completeCanonicalFoodProcessing({
    registry: fixture.registry,
    contextId: processing.context?.contextId,
    generationId: fixture.generationId,
    worldClock: processing.context?.expectedCompletionClock ?? 1,
    inventory: fixture.inventory,
    recipient: fixture.actor,
    capacity: options.capacity ?? 30,
    outcome: options.outcome || "success",
  }));
  if (result.accepted) fixture.inventory = result.inventory;
  return result;
};

export function runRoastBoarMeatScenario() {
  const fixture = createFixture({ generationId: "phase3c4c-roast" });
  const processing = start(fixture);
  const completion = finish(fixture, processing);
  return { key: "recover-and-roast-boar-meat", ...fixture, processing, completion, huntingOutcomeCount: 1 };
}

export function runNoFuelScenario() {
  const fixture = createFixture({ generationId: "phase3c4c-no-fuel" });
  const registry = createCanonicalFoodProcessingRegistry();
  const inventory = fixture.inventory.filter((item) => item.itemKey !== "resource.firewood");
  const actionToken = "phase3c4c-no-fuel:fire:1";
  const fire = establishCanonicalHeatSource({
    registry,
    actor: { ...fixture.actor, inventory },
    generationId: fixture.generationId,
    initiativeTurnId: "phase3c4c-no-fuel:fire",
    actionToken,
    authoritativeTurn: turn(fixture.actor.id, fixture.generationId, "phase3c4c-no-fuel:fire", actionToken),
    inventory,
    fuelItemId: "resource.firewood",
    ignitionItemId: "tool.flint-and-steel",
  });
  return { key: "cooking-without-fuel", ...fixture, fire, rawQuantity: fixture.registered.food.quantity, huntingOutcomeCount: 1 };
}

export function runShelteredRainScenario() {
  const exposed = createFixture({ generationId: "phase3c4c-rain-exposed", environment: { terrain: "camp", weather: "rain", shelter: false } });
  const sheltered = createFixture({ generationId: "phase3c4c-rain-sheltered", environment: { terrain: "camp", weather: "rain", shelter: true } });
  return { key: "build-fire-in-sheltered-rain", exposed, sheltered, events: [...exposed.events, ...sheltered.events], huntingOutcomeCount: 1 };
}

export function runFullInventoryCampOutputScenario() {
  const fixture = createFixture({ generationId: "phase3c4c-capacity" });
  const processing = start(fixture);
  const completion = finish(fixture, processing, { capacity: 1 });
  return { key: "full-inventory-output-at-camp", ...fixture, processing, completion, huntingOutcomeCount: 1 };
}

export function runSmokingScenario() {
  const fixture = createFixture({ generationId: "phase3c4c-smoke", heatSourceType: "smoking-fire" });
  const processing = start(fixture, { recipeKey: "smoke-game-meat" });
  const completion = finish(fixture, processing);
  return { key: "start-and-complete-smoking", ...fixture, processing, completion, huntingOutcomeCount: 1 };
}

export function runInterruptedCookingScenario() {
  const fixture = createFixture({ generationId: "phase3c4c-interrupt" });
  const processing = start(fixture);
  const extinguished = collect(fixture.events, extinguishCanonicalHeatSource({
    registry: fixture.registry,
    heatSourceId: fixture.fire.heatSource.heatSourceId,
    actorId: fixture.actor.id,
    generationId: fixture.generationId,
  }));
  const completion = finish(fixture, processing);
  return { key: "interrupt-cooking-by-extinguishing-fire", ...fixture, processing, extinguished, completion, huntingOutcomeCount: 1 };
}

export function runSpoilageComparisonScenario() {
  const cool = createFixture({ generationId: "phase3c4c-cool" });
  const warm = createFixture({ generationId: "phase3c4c-warm" });
  const coolResult = collect(cool.events, evaluateCanonicalFoodFreshness({
    registry: cool.registry,
    foodId: cool.registered.food.foodId,
    generationId: cool.generationId,
    worldClock: 20,
    storageContext: { locationType: "container", temperatureClass: "cool", moistureClass: "dry", exposureClass: "covered" },
  }));
  const warmResult = collect(warm.events, evaluateCanonicalFoodFreshness({
    registry: warm.registry,
    foodId: warm.registered.food.foodId,
    generationId: warm.generationId,
    worldClock: 20,
    storageContext: { locationType: "camp-cache", temperatureClass: "warm", moistureClass: "normal", exposureClass: "exposed" },
  }));
  return { key: "cool-covered-versus-warm-exposed", cool, warm, coolResult, warmResult, events: [...cool.events, ...warm.events], huntingOutcomeCount: 1 };
}

export function runMealConsumptionScenario() {
  const fixture = createFixture({ generationId: "phase3c4c-meal" });
  const processing = start(fixture);
  const completion = finish(fixture, processing);
  const initiativeTurnId = "phase3c4c-meal:turn:eat";
  const actionToken = `${initiativeTurnId}:1`;
  const meal = collect(fixture.events, consumeCanonicalMealPortion({
    registry: fixture.registry,
    actor: fixture.actor,
    foodId: completion.output.foodId,
    generationId: fixture.generationId,
    initiativeTurnId,
    actionToken,
    authoritativeTurn: turn(fixture.actor.id, fixture.generationId, initiativeTurnId, actionToken),
    inventoryAccess: true,
    worldClock: 2,
    inventory: fixture.inventory,
  }));
  return { key: "consume-one-cooked-portion", ...fixture, processing, completion, meal, huntingOutcomeCount: 1 };
}

export function runQuestionableInspectionScenario() {
  const fixture = createFixture({ generationId: "phase3c4c-inspect" });
  fixture.registered.food.freshnessState = "questionable";
  const inspection = collect(fixture.events, inspectCanonicalFood({
    registry: fixture.registry,
    foodId: fixture.registered.food.foodId,
    actorId: fixture.actor.id,
    generationId: fixture.generationId,
  }));
  return { key: "inspect-questionable-food", ...fixture, inspection, huntingOutcomeCount: 1 };
}

export function runSpoiledFoodScenario() {
  const fixture = createFixture({ generationId: "phase3c4c-spoiled" });
  fixture.registered.food.freshnessState = "spoiled";
  fixture.registered.food.processingState = "spoiled";
  const initiativeTurnId = "phase3c4c-spoiled:turn:eat";
  const actionToken = `${initiativeTurnId}:1`;
  const meal = collect(fixture.events, consumeCanonicalMealPortion({
    registry: fixture.registry,
    actor: fixture.actor,
    foodId: fixture.registered.food.foodId,
    generationId: fixture.generationId,
    initiativeTurnId,
    actionToken,
    authoritativeTurn: turn(fixture.actor.id, fixture.generationId, initiativeTurnId, actionToken),
    inventoryAccess: true,
  }));
  return { key: "warn-on-spoiled-food", ...fixture, meal, huntingOutcomeCount: 1 };
}

export function runCanceledProcessingScenario() {
  const fixture = createFixture({ generationId: "phase3c4c-cancel" });
  const processing = start(fixture);
  const canceled = collect(fixture.events, cancelCanonicalFoodProcessing({
    registry: fixture.registry,
    contextId: processing.context.contextId,
    generationId: fixture.generationId,
    reason: "threat-returned",
    inventory: fixture.inventory,
  }));
  if (canceled.accepted) fixture.inventory = canceled.inventory;
  const staleCompletion = finish(fixture, processing);
  return { key: "cancel-active-processing", ...fixture, processing, canceled, staleCompletion, huntingOutcomeCount: 1 };
}

export function runFullHuntHarvestCookingScenario() {
  const phase3c4b = runRecoveredBoarProcessingScenario();
  const transferredRaw = phase3c4b.transfer?.recipient?.inventory?.find((item) => item.inventoryItemKey === "resource.raw-game-meat");
  const generationId = phase3c4b.encounter.generationId;
  const registry = createCanonicalFoodProcessingRegistry();
  const events = [...phase3c4b.events];
  const actor = {
    ...phase3c4b.hunter,
    position: { x: 0, y: 0 },
    x: 0,
    y: 0,
    currentStamina: 8,
    maxStamina: 12,
    nourishmentState: { status: "hungry", updateCount: 0 },
  };
  let inventory = [
    ...phase3c4b.transfer.recipient.inventory,
    ...inventoryFixtures().filter((item) => item.itemKey !== "resource.raw-game-meat"),
  ];
  const registered = collect(events, registerCanonicalHarvestedFoodResource({
    registry,
    item: transferredRaw,
    owner: actor,
    sourceCarcass: phase3c4b.carcass,
    generationId,
    worldClock: 0,
  }));
  const fireTurnId = `${generationId}:food-turn:fire`;
  const fireToken = `${fireTurnId}:1`;
  const fire = collect(events, establishCanonicalHeatSource({
    registry,
    actor: { ...actor, inventory },
    generationId,
    initiativeTurnId: fireTurnId,
    actionToken: fireToken,
    authoritativeTurn: turn(actor.id, generationId, fireTurnId, fireToken),
    inventory,
    location: actor.position,
    environment: { terrain: "camp", shelter: true, weather: "clear" },
    fuelItemId: "resource.firewood",
    ignitionItemId: "tool.flint-and-steel",
    worldClock: 0,
  }));
  inventory = fire.inventory;
  const fixture = {
    generationId,
    registry,
    actor,
    carcass: phase3c4b.carcass,
    inventory,
    events,
    registered,
    fire,
    environment: { terrain: "camp", shelter: true, weather: "clear" },
  };
  const sourceBoundaryPreserved = Boolean(
    transferredRaw
    && registered.accepted
    && registered.food.sourceCarcassId === phase3c4b.carcass.carcassId
  );
  const processing = start(fixture);
  const completion = finish(fixture, processing);
  return {
    key: "full-hunting-harvest-cooking-chain",
    ...fixture,
    phase3c4b,
    processing,
    completion,
    sourceBoundaryPreserved,
    huntingOutcomeCount: phase3c4b.events.filter((entry) => entry.eventType === "hunting-outcome-committed").length || 1,
  };
}

export function runPhase3C4CFoodBrowserScenarios() {
  const scenarios = [
    runRoastBoarMeatScenario(),
    runNoFuelScenario(),
    runShelteredRainScenario(),
    runFullInventoryCampOutputScenario(),
    runSmokingScenario(),
    runInterruptedCookingScenario(),
    runSpoilageComparisonScenario(),
    runMealConsumptionScenario(),
    runQuestionableInspectionScenario(),
    runSpoiledFoodScenario(),
    runCanceledProcessingScenario(),
    runFullHuntHarvestCookingScenario(),
  ];
  const authorityDiagnostics = scenarios.flatMap((scenario) => {
    const registries = [scenario.registry, scenario.cool?.registry, scenario.warm?.registry].filter(Boolean);
    return registries.flatMap((registry) => validateCanonicalFoodProcessingState({
      foods: [...registry.foods.values()],
      heatSources: [...registry.heatSources.values()],
      contexts: [...registry.contexts.values()],
      mealResults: [scenario.meal?.mealResult].filter(Boolean),
    }).diagnostics);
  });
  return {
    route: "/combat",
    scenarios,
    authorityDiagnostics,
    scenarioDiagnostics: authorityDiagnostics,
    encounterOverCount: 1,
  };
}

export default runPhase3C4CFoodBrowserScenarios;
