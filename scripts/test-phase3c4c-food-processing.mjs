import assert from "node:assert/strict";
import fs from "node:fs";

import {
  CANONICAL_FOOD_RECIPES,
  FOOD_PROCESSING_ACTIONS,
  addCanonicalHeatSourceFuel,
  consumeCanonicalMealPortion,
  discardCanonicalFood,
  filterCanonicalFoodProcessingAIActions,
  getCanonicalFoodProcessingPresentation,
  validateCanonicalFoodProcessingState,
  validateCanonicalFoodRecipe,
} from "../src/utils/combat/canonicalFoodProcessing.js";
import {
  runPhase3C4CFoodBrowserScenarios,
  runRoastBoarMeatScenario,
} from "../src/utils/combat/phase3c4cFoodScenarios.js";
import { buildCombatActionCatalog, getCombatActionContract } from "../src/utils/combatActionCatalog.js";

let passed = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  passed += 1;
};
const exact = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  passed += 1;
};
const turn = (actorId, generationId, initiativeTurnId, actionToken) => ({
  actorId, generationId, initiativeTurnId, actionToken,
});

const report = runPhase3C4CFoodBrowserScenarios();
const scenarioKeys = [
  "recover-and-roast-boar-meat",
  "cooking-without-fuel",
  "build-fire-in-sheltered-rain",
  "full-inventory-output-at-camp",
  "start-and-complete-smoking",
  "interrupt-cooking-by-extinguishing-fire",
  "cool-covered-versus-warm-exposed",
  "consume-one-cooked-portion",
  "inspect-questionable-food",
  "warn-on-spoiled-food",
  "cancel-active-processing",
  "full-hunting-harvest-cooking-chain",
];

exact(report.route, "/combat", "browser route");
exact(report.scenarios.length, 12, "twelve scenarios");
exact(report.authorityDiagnostics.length, 0, "zero authority diagnostics");
exact(report.scenarioDiagnostics.length, 0, "zero scenario diagnostics");
exact(report.encounterOverCount, 1, "one encounter outcome");
scenarioKeys.forEach((key, index) => exact(report.scenarios[index].key, key, `scenario ${key}`));
report.scenarios.forEach((scenario) => exact(scenario.huntingOutcomeCount, 1, `${scenario.key} preserves one hunting outcome`));

const roast = report.scenarios[0];
check(roast.registered.accepted, "Phase 3C4B food resource registers");
check(roast.fire.accepted, "fire established");
check(roast.processing.accepted, "roast starts");
check(roast.completion.accepted, "roast completes");
exact(roast.completion.output.processingState, "cooked", "raw becomes cooked");
exact(roast.completion.input.quantity, 2, "one raw unit consumed");
exact(roast.completion.output.quantity, 1, "one output committed");
exact(roast.completion.output.portionState.totalPortions, 2, "two portions created");
exact(roast.completion.context.completionCount, 1, "completion once");
check(roast.completion.output.sourceFoodId === roast.registered.food.foodId, "food lineage retained");
check(roast.completion.output.sourceCarcassId === roast.carcass.carcassId, "carcass lineage retained");
check(roast.completion.output.batchId === roast.registered.food.batchId, "batch lineage retained");
check(!roast.events.some((entry) => entry.eventType === "hunting-outcome-committed"), "cooking creates no hunting outcome");

const noFuel = report.scenarios[1];
exact(noFuel.fire.accepted, false, "fire rejects no fuel");
exact(noFuel.fire.reason, "missing-required-fuel", "missing fuel reason");
exact(noFuel.rawQuantity, 3, "raw meat unchanged on fire rejection");
check(!noFuel.fire.heatSource, "no phantom heat source");

const rain = report.scenarios[2];
exact(rain.exposed.fire.accepted, false, "exposed rain rejected");
exact(rain.exposed.fire.reason, "exposed-rain-ignition-rejected", "rain rejection reason");
exact(rain.sheltered.fire.accepted, true, "sheltered rain legal");
exact(rain.sheltered.fire.heatSource.shelterState, "sheltered", "shelter recorded");
exact(rain.sheltered.fire.heatSource.weatherExposure, "rain", "weather recorded");

const capacity = report.scenarios[3];
exact(capacity.completion.outputLocation, "camp-cache", "full inventory leaves output at camp");
check(capacity.completion.campCache?.cacheId, "camp cache has stable identity");
check(capacity.registry.campCaches.has(capacity.completion.campCache.cacheId), "cache registered");
exact(capacity.completion.output.storageContext.locationType, "camp-cache", "output storage is location bound");

const smoke = report.scenarios[4];
exact(smoke.processing.context.actorReleasedAfterSetup, true, "extended process releases actor");
exact(smoke.completion.output.processingState, "smoked", "smoked output");
check(smoke.completion.output.preservationMethods.includes("smoked"), "smoking preservation recorded");
exact(new Set(smoke.completion.output.preservationMethods).size, smoke.completion.output.preservationMethods.length, "preservation nonstacking");

const interrupted = report.scenarios[5];
exact(interrupted.extinguished.heatSource.state, "extinguished", "fire extinguished");
exact(interrupted.completion.accepted, false, "lost fire interrupts");
exact(interrupted.completion.reason, "heat-source-lost", "interruption reason");
exact(interrupted.processing.context.state, "interrupted", "context interrupted");
exact(interrupted.registered.food.reservation, null, "reservation released after interruption");

const spoilage = report.scenarios[6];
check(spoilage.warmResult.effectiveElapsed > spoilage.coolResult.effectiveElapsed, "warm exposed food degrades faster");
exact(spoilage.coolResult.food.storageContext.temperatureClass, "cool", "cool storage recorded");
exact(spoilage.warmResult.food.storageContext.exposureClass, "exposed", "exposure recorded");
check(["fresh", "aging"].includes(spoilage.coolResult.food.freshnessState), "cool batch remains better");
check(["aging", "questionable", "spoiled"].includes(spoilage.warmResult.food.freshnessState), "warm batch progresses");

const mealScenario = report.scenarios[7];
exact(mealScenario.meal.accepted, true, "meal accepted");
exact(mealScenario.meal.food.portionState.consumedPortions, 1, "one portion consumed");
exact(mealScenario.meal.food.portionState.remainingPortions, 1, "one portion remains");
exact(mealScenario.meal.mealResult.hpHealing, 0, "meal heals no HP");
exact(mealScenario.meal.mealResult.clearedInjuries.length, 0, "meal clears no injury");
check(mealScenario.meal.mealResult.staminaRecovery <= 2, "stamina benefit bounded");
exact(mealScenario.meal.actorPatch.currentHP, mealScenario.actor.currentHP, "HP preserved");
exact(mealScenario.meal.actorPatch.nourishmentState.updateCount, 1, "nourishment updates once");

const questionable = report.scenarios[8];
exact(questionable.inspection.accepted, true, "questionable inspection accepted");
exact(questionable.inspection.inspection.risk, "warning", "questionable warning");
exact(questionable.inspection.inspection.freshnessState, "questionable", "inspection truthful");

const spoiled = report.scenarios[9];
exact(spoiled.meal.accepted, false, "ordinary spoiled meal blocked");
exact(spoiled.meal.reason, "spoiled-food-confirmation-required", "spoiled warning reason");
exact(spoiled.registered.food.portionState.consumedPortions, 0, "spoiled rejection consumes no portion");

const canceled = report.scenarios[10];
exact(canceled.canceled.accepted, true, "processing cancellation accepted");
exact(canceled.processing.context.state, "canceled", "context canceled");
exact(canceled.registered.food.reservation, null, "cancellation releases food");
exact(canceled.staleCompletion.accepted, false, "stale completion blocked");
exact(canceled.staleCompletion.reason, "stale-food-processing-callback", "stale completion reason");

const fullChain = report.scenarios[11];
check(fullChain.sourceBoundaryPreserved, "Phase 3C4B transfer is Phase 3C4C boundary");
check(fullChain.phase3c4b.carcass.carcassId, "carcass identity preserved");
exact(fullChain.completion.context.completionCount, 1, "full chain cooking completes once");
exact(fullChain.huntingOutcomeCount, 1, "full chain has one hunting outcome");

const expectedFoodFields = [
  "foodId", "sourceResourceId", "sourceCarcassId", "sourceActorId", "category",
  "processingState", "freshnessState", "contaminationState", "quantity", "quantityUnit",
  "portionCount", "createdAtClock", "lastProcessedAtClock", "lastStorageEvaluationAtClock",
  "storageContext", "preservationMethods", "recipeKey", "batchId", "processingOwner",
  "resourceLedgerId", "state",
];
expectedFoodFields.forEach((field) => check(field in roast.completion.output, `food state field ${field}`));
check(JSON.parse(JSON.stringify(roast.completion.output)).foodId === roast.completion.output.foodId, "food state serializable");
check(roast.completion.output.foodId !== roast.completion.output.name, "identity independent of display label");
check(roast.completion.output.foodId.includes(roast.registered.food.foodId), "replacement identity preserves source");

const expectedHeatFields = [
  "heatSourceId", "type", "state", "location", "heatClass", "fuelLedger",
  "remainingFuelClass", "smokeClass", "shelterState", "weatherExposure",
  "createdByActorId", "createdByActionToken", "scheduleOwner", "stateVersion",
];
expectedHeatFields.forEach((field) => check(field in roast.fire.heatSource, `heat field ${field}`));
exact(roast.fire.heatSource.fuelLedger[0].reservedQuantity, 1, "fuel reserved once");
exact(roast.fire.heatSource.fuelLedger[0].consumedQuantity, 1, "fuel consumed once");
exact(roast.fire.heatSource.fuelLedger[0].returnedQuantity, 0, "fuel return ledger explicit");
exact(roast.fire.heatSource.fuelLedger[0].state, "consumed", "fuel ledger terminal");

const recipeKeys = [
  "roast-game-meat",
  "cook-game-meat-portions",
  "smoke-game-meat",
  "dry-game-meat",
  "salt-game-meat",
];
recipeKeys.forEach((key) => {
  const recipe = CANONICAL_FOOD_RECIPES[key];
  exact(recipe.key, key, `${key} stable key`);
  check(recipe.processingMethod, `${key} method`);
  check(recipe.durationClass, `${key} duration class`);
  check(recipe.uncertaintyClass, `${key} uncertainty class`);
  check(Array.isArray(recipe.requiredToolCapabilities), `${key} tool authority`);
  check(Array.isArray(recipe.requiredIngredientKeys), `${key} ingredient authority`);
});
exact(CANONICAL_FOOD_RECIPES["roast-game-meat"].skillRequirement, null, "simple roast permits untrained cook");
check(CANONICAL_FOOD_RECIPES["cook-game-meat-portions"].requiredToolCapabilities.includes("cooking-vessel"), "pot recipe requires vessel");
check(CANONICAL_FOOD_RECIPES["cook-game-meat-portions"].requiredIngredientKeys.includes("resource.water"), "pot recipe requires water");
check(CANONICAL_FOOD_RECIPES["salt-game-meat"].requiredIngredientKeys.includes("resource.salt"), "salt recipe requires actual salt");

const actionKeys = [
  "build-fire", "add-fuel", "extinguish-fire", "prepare-food", "roast-meat",
  "cook-food", "smoke-food", "dry-food", "salt-food", "inspect-food",
  "consume-meal", "discard-food", "pack-food", "retrieve-food", "cancel-food-processing",
];
exact(Object.keys(FOOD_PROCESSING_ACTIONS), actionKeys, "food action keys");
exact(new Set(actionKeys).size, actionKeys.length, "food action keys unique");
actionKeys.forEach((key) => {
  exact(FOOD_PROCESSING_ACTIONS[key].key, key, `${key} stable contract`);
  exact(getCombatActionContract(key).executorIdentity, "canonical-food-processing", `${key} catalog executor`);
});

const actor = { ...roast.actor, inventory: roast.inventory, remainingActions: 2 };
const catalog = buildCombatActionCatalog({
  actor,
  currentTurnEntry: { actorId: actor.id, remainingActions: 2 },
  inventory: roast.inventory,
  foodProcessingContext: {
    enabled: true,
    foods: [roast.registered.food],
    heatSources: [roast.fire.heatSource],
    inventory: roast.inventory,
    legalFireLocation: true,
  },
});
actionKeys.forEach((key) => check(catalog.some((action) => action.type === key), `${key} exposed through catalog`));
exact(new Set(catalog.map((action) => action.id)).size, catalog.length, "catalog entries unique");

const missingSalt = validateCanonicalFoodRecipe({
  recipeKey: "salt-game-meat",
  food: roast.registered.food,
  actor,
  inventory: roast.inventory,
  tools: roast.inventory,
  environment: { shelter: true },
});
exact(missingSalt.accepted, false, "salting unavailable without salt");
exact(missingSalt.reason, "salting-without-salt-inventory", "salting missing salt reason");

const wetDrying = validateCanonicalFoodRecipe({
  recipeKey: "dry-game-meat",
  food: roast.registered.food,
  actor,
  inventory: roast.inventory,
  tools: roast.inventory,
  environment: { weather: "rain", humidity: "wet" },
});
exact(wetDrying.accepted, false, "wet drying rejected");
exact(wetDrying.reason, "drying-in-illegal-environment", "wet drying reason");

const distantHeat = validateCanonicalFoodRecipe({
  recipeKey: "roast-game-meat",
  food: roast.registered.food,
  actor: { ...actor, position: { x: 20, y: 20 } },
  heatSource: roast.fire.heatSource,
  inventory: roast.inventory,
  tools: roast.inventory,
});
exact(distantHeat.accepted, false, "distant heat rejected");
exact(distantHeat.reason, "distant-heat-source-use", "distant heat reason");

const addedFuel = addCanonicalHeatSourceFuel({
  registry: roast.registry,
  heatSourceId: roast.fire.heatSource.heatSourceId,
  actor,
  generationId: roast.generationId,
  actionToken: "phase3c4c:add-fuel:1",
  inventory: roast.inventory,
  fuelItemId: "resource.firewood",
});
check(addedFuel.accepted, "add fuel accepted");
exact(addedFuel.heatSource.state, "burning", "add fuel restores burning");
exact(addedFuel.heatSource.fuelLedger.at(-1).consumedQuantity, 1, "added fuel consumed once");

const duplicateFuel = addCanonicalHeatSourceFuel({
  registry: roast.registry,
  heatSourceId: roast.fire.heatSource.heatSourceId,
  actor,
  generationId: roast.generationId,
  actionToken: "phase3c4c:add-fuel:1",
  inventory: roast.inventory,
  fuelItemId: "resource.firewood",
});
exact(duplicateFuel.accepted, false, "duplicate fuel callback rejected");
exact(duplicateFuel.reason, "duplicate-fuel-consumption", "duplicate fuel reason");

const duplicateMeal = consumeCanonicalMealPortion({
  registry: mealScenario.registry,
  actor: mealScenario.actor,
  foodId: mealScenario.completion.output.foodId,
  generationId: mealScenario.generationId,
  initiativeTurnId: "phase3c4c-meal:turn:eat",
  actionToken: "phase3c4c-meal:turn:eat:1",
  authoritativeTurn: turn(mealScenario.actor.id, mealScenario.generationId, "phase3c4c-meal:turn:eat", "phase3c4c-meal:turn:eat:1"),
});
exact(duplicateMeal.accepted, false, "duplicate meal callback rejected");
exact(duplicateMeal.reason, "duplicate-meal-result", "duplicate meal reason");

const discardFixture = runRoastBoarMeatScenario();
const discarded = discardCanonicalFood({
  registry: discardFixture.registry,
  foodId: discardFixture.completion.output.foodId,
  actorId: discardFixture.actor.id,
  generationId: discardFixture.generationId,
});
check(discarded.accepted, "discard accepted");
exact(discarded.food.state, "discarded", "discard terminal state");
exact(discarded.food.portionState.remainingPortions, 0, "discard removes usable portions");
exact(discarded.food.portionState.discardedPortions, 2, "discard ledger reconciles");

const presentation = getCanonicalFoodProcessingPresentation({
  foods: [mealScenario.completion.output],
  heatSources: [mealScenario.fire.heatSource],
  contexts: [mealScenario.processing.context],
});
check(presentation.visible, "food presentation visible");
check(presentation.foodCount >= 1, "presentation food count");
check(presentation.portions >= 1, "presentation portions");
check(["burning", "embers"].includes(presentation.heatSourceState), "presentation heat state");

const aiActions = filterCanonicalFoodProcessingAIActions({
  actor: { ...actor, nourishmentState: { status: "hungry" } },
  actions: actionKeys.map((key) => ({ key })),
  rawFoodAvailable: true,
  cookedFoodAvailable: true,
  safeCamp: true,
  heatAvailable: true,
  preservationSetup: true,
});
check(aiActions.some((action) => action.key === "consume-meal"), "hungry AI may eat");
check(aiActions.some((action) => action.key === "roast-meat"), "safe AI may cook");
const threatenedAi = filterCanonicalFoodProcessingAIActions({
  actor,
  actions: actionKeys.map((key) => ({ key })),
  immediateCombatActive: true,
  urgentThreat: true,
  rawFoodAvailable: true,
  cookedFoodAvailable: true,
});
exact(threatenedAi.length, 0, "AI does not cook during combat");

const validState = validateCanonicalFoodProcessingState({
  foods: [mealScenario.completion.output],
  heatSources: [mealScenario.fire.heatSource],
  contexts: [mealScenario.processing.context],
  mealResults: [mealScenario.meal.mealResult],
});
check(validState.valid, "valid food state passes audit");
exact(validState.diagnostics.length, 0, "valid state diagnostics zero");

const combatActorSource = fs.readFileSync("src/utils/combat/normalizeCombatActorSchema.js", "utf8");
const wildlifeSource = fs.readFileSync("src/utils/combat/liveWildlifeConcealmentRanged.js", "utf8");
const rangeSource = fs.readFileSync("src/utils/rangedAttackRangeModifier.js", "utf8");
const carcassSource = fs.readFileSync("src/utils/combat/canonicalCarcassProcessing.js", "utf8");
check(combatActorSource.includes('"food-processing-completion"'), "normalization blocked during food completion");
check(combatActorSource.includes("rangedTrainingProfile"), "Longbow training preserved");
check(wildlifeSource.includes('bodyPlan === "avian"'), "avian authority preserved");
check(wildlifeSource.includes("visibilityByObserver"), "per-observer visibility preserved");
check(wildlifeSource.includes("no-concealment-source"), "real concealment preserved");
check(rangeSource.includes('band = "extreme"'), "extreme range preserved");
check(rangeSource.includes("trainingModifier"), "longbow-only training path preserved");
check(carcassSource.includes("recoverCanonicalEmbeddedProjectile"), "projectile recovery preserved");
check(carcassSource.includes("harvest-before-recovery"), "recovery gate preserved");
check(carcassSource.includes("harvest-capacity-rejected"), "capacity gate preserved");

check(passed >= 140, `expected at least 140 assertions, got ${passed}`);
console.log(`Phase 3C4C food-processing tests passed: ${passed}`);
