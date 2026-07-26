import assert from "node:assert/strict";
import fs from "node:fs";
import { getCanonicalCombatActorDefinition } from "../src/data/canonicalCombatActors.js";
import {
  CANONICAL_HARVEST_PROFILES,
  CANONICAL_HARVEST_RESOURCE_ITEMS,
  CARCASS_PROCESSING_ACTIONS,
  abandonCanonicalCarcass,
  claimCanonicalCarcassProcessingAction,
  classifyCanonicalProcessingTool,
  completeCanonicalCarcassProcessingAction,
  createCanonicalProcessingCarcass,
  finalizeCanonicalCarcassProcessing,
  recoverProcessingCarcass,
  requestHarvestInventoryTransfer,
  resolveCanonicalCarcassCondition,
  resolveCarcassHarvestEligibility,
} from "../src/utils/combat/canonicalCarcassProcessing.js";
import { createCanonicalHuntingRegistry } from "../src/utils/combat/canonicalHuntingEncounter.js";
import { normalizeReferenceCombatActor } from "../src/utils/combat/normalizeCombatActorSchema.js";
import { runPhase3C4BCarcassBrowserScenarios } from "../src/utils/combat/phase3c4bCarcassScenarios.js";

let passed = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  passed += 1;
};
const clone = (value) => structuredClone(value);
const def = (key) => clone(getCanonicalCombatActorDefinition(key));
const browser = runPhase3C4BCarcassBrowserScenarios();
const [boarScenario, escapeScenario, , arrowScenario, protectedScenario] = browser.scenarios;
const source = fs.readFileSync(new URL("../src/utils/combat/canonicalCarcassProcessing.js", import.meta.url), "utf8");
const normalizationSource = fs.readFileSync(new URL("../src/utils/combat/normalizeCombatActorSchema.js", import.meta.url), "utf8");
const panelSource = fs.readFileSync(new URL("../src/components/HuntingEncounterPanel.jsx", import.meta.url), "utf8");
const eventCount = (scenario, type) => scenario.events.filter((entry) => entry.eventType === type).length;

const actor = (actorKey, id, extra = {}) => normalizeReferenceCombatActor({
  ...def(actorKey), id, team: "neutral", side: "neutral", battleSide: "neutral",
  position: { x: 0, y: 0 }, x: 0, y: 0, ...extra,
}, { source: "phase3c4b-test" }).normalizedActor;

// 1-17: death, identity, recovery, claims, and protection.
check(eventCount(boarScenario, "carcass-created") === 1, "1 authoritative death creates one carcass");
{
  const result = createCanonicalProcessingCarcass({
    huntingRegistry: createCanonicalHuntingRegistry(),
    sourceActor: actor("boar", "unconscious-boar", { unconscious: true, dead: false }),
    generationId: "g", deathEventId: "d",
  });
  check(!result.accepted, "2 unconscious animal creates no carcass");
}
check(escapeScenario.carcass === null && escapeScenario.hunting.registry.carcasses.size === 0, "3 escaped quarry creates no carcass");
{
  const result = createCanonicalProcessingCarcass({
    huntingRegistry: createCanonicalHuntingRegistry(),
    sourceActor: actor("boar", "zero-boar", { currentHP: 0, dead: false }),
    generationId: "g", deathEventId: "d",
  });
  check(!result.accepted, "4 zero HP without death creates no carcass");
}
{
  const registry = createCanonicalHuntingRegistry();
  const dead = actor("boar", "duplicate-boar", { dead: true, currentHP: 0 });
  const args = { huntingRegistry: registry, sourceActor: dead, generationId: "g", deathEventId: "d" };
  createCanonicalProcessingCarcass(args);
  check(!createCanonicalProcessingCarcass(args).accepted, "5 duplicate carcass rejected");
}
check(boarScenario.carcass.sourceActorId === boarScenario.sourceActor.id, "6 source actor ID retained");
check(boarScenario.carcass.species === boarScenario.sourceActor.species && boarScenario.carcass.size === "medium", "7 species and size retained");
check(boarScenario.carcass.deathPosition.x === boarScenario.sourceActor.position.x, "8 death position retained");
check(["intact", "damaged", "heavily-damaged", "mutilated"].includes(boarScenario.carcass.conditionProfile.bodyCondition), "9 condition explicit");
{
  const carcass = { ...boarScenario.carcass, recoveryState: "unrecovered" };
  check(!recoverProcessingCarcass({ carcass, processor: boarScenario.hunter, actionToken: "x" }).accepted, "10 must locate before recovery");
}
{
  const carcass = { ...boarScenario.carcass, recoveryState: "located", locatedPosition: { x: 100, y: 100 } };
  check(!recoverProcessingCarcass({ carcass, processor: boarScenario.hunter, processorPosition: { x: 0, y: 0 }, actionToken: "x" }).accepted, "11 legal recovery position required");
}
check(boarScenario.carcass.recoveryPosition.x === boarScenario.carcass.deathPosition.x, "12 recovery does not teleport");
check(boarScenario.carcass.carcassClaim.claimantId === boarScenario.hunter.id, "13 explicit claim");
check(boarScenario.carcass.carcassClaim.claimantId !== boarScenario.hunter.name, "14 display name not claim authority");
check(protectedScenario.eligibility.classification === "companion-protected" && !protectedScenario.eligibility.authorized, "15 companion protected");
{
  const horse = actor("warhorse", "dead-warhorse", { dead: true, currentHP: 0 });
  const carcass = { sourceActorId: horse.id, sourceActorKey: horse.actorKey, deathEventId: "d" };
  const result = resolveCarcassHarvestEligibility({ carcass, sourceActor: horse, mountLink: { state: "active" } });
  check(result.classification === "mount-protected" && !result.authorized, "16 mount protected");
}
check(boarScenario.eligibility.classification === "ordinary-game" && boarScenario.eligibility.authorized, "17 wild Boar harvestable");

// 18-37: field dressing, profiles, yields, and ledger.
check(boarScenario.carcass.recoveryState === "claimed" && boarScenario.dressing.result.accepted, "18 field dressing requires recovery");
check(boarScenario.dressing.claim.claim.actionToken === "processing:1", "19 field dressing owns action");
check(eventCount(boarScenario, "field-dressing-completed") === 1, "20 field dressing completes once");
check(!completeCanonicalCarcassProcessingAction({ registry: boarScenario.processingRegistry, claim: boarScenario.dressing.claim.claim }).accepted, "21 stale field dressing rejected");
check(CANONICAL_HARVEST_PROFILES.boar.toolRequirements.fieldDressing.includes("field-dressing"), "22 tools profile-driven");
{
  const knife = def("longbowman").weaponProfiles.find((weapon) => /knife/i.test(weapon.name));
  const before = JSON.stringify(knife);
  const classification = classifyCanonicalProcessingTool(knife);
  check(classification.combatProfileUnchanged && JSON.stringify(knife) === before, "23 tool tags do not change combat stats");
}
check(CANONICAL_HARVEST_PROFILES.boar.profileKey === "harvest.boar", "24 harvest profile explicit");
check(CANONICAL_HARVEST_PROFILES.boar.profileKey !== CANONICAL_HARVEST_PROFILES.bear.profileKey, "25 Boar not Bear profile");
check(CANONICAL_HARVEST_PROFILES.bear.profileKey !== CANONICAL_HARVEST_PROFILES["brown-bear"].profileKey, "26 bears distinct");
check(CANONICAL_HARVEST_PROFILES.warhorse.protectedByDefault, "27 Warhorse not ordinary harvest");
check(CANONICAL_HARVEST_PROFILES.hawk.protectedByDefault, "28 Hawk not ordinary loot");
check(CANONICAL_HARVEST_PROFILES["giant-rat"].foodSafety === "contamination-restricted", "29 Giant Rat contamination boundary");
check(boarScenario.meat.result.resourceResults[0].quantity <= CANONICAL_HARVEST_PROFILES.boar.potentialResources.find((entry) => entry.resourceKey === "meat").quantityAuthority.quantity, "30 yield within profile");
{
  const condition = resolveCanonicalCarcassCondition({ sourceActor: { injuryState: { lostLocations: ["skin"] } } });
  check(condition.lostLocations.includes("skin"), "31 destroyed locations retained for yield filtering");
}
check(source.includes('if (resourceEntry.resourceKey === "tusk" && locations.has("tusks"))'), "32 missing tusk unavailable");
check(boarScenario.carcass.remainingResources.hide.harvestedQuantity === 1, "33 hide extracted once");
check(boarScenario.carcass.remainingResources.tusk.harvestedQuantity === 2, "34 tusks extracted once");
check(["processing:2", "processing:3", "processing:4"].every((token) => Object.values(boarScenario.carcass.remainingResources).some((entry) => entry.lastMutationToken === token)), "35 ledger updates once");
check(boarScenario.carcass.processingState === "partially-harvested", "36 partial carcass remains partial");
check(!claimCanonicalCarcassProcessingAction({
  registry: boarScenario.processingRegistry,
  carcass: { ...boarScenario.carcass, processingState: "fully-harvested" },
  processor: boarScenario.hunter,
  actionKey: "harvest-meat",
  actionToken: "after-full", initiativeTurnId: "t", generationId: "g",
  authoritativeTurn: { actorId: boarScenario.hunter.id, actionToken: "after-full", initiativeTurnId: "t", generationId: "g" },
}).accepted, "37 fully harvested cannot produce more");

// 38-55: items, capacity, transfer, and projectile recovery.
check(CANONICAL_HARVEST_RESOURCE_ITEMS.meat.itemKey === "resource.raw-game-meat", "38 stable item identity");
check(CANONICAL_HARVEST_RESOURCE_ITEMS.meat.stackProfile.identityField === "itemKey", "39 deterministic stack");
check(CANONICAL_HARVEST_RESOURCE_ITEMS.meat.unitWeight === 1, "40 unit weight explicit");
check(boarScenario.transfer.availableCapacity === 12, "41 capacity checked");
check(boarScenario.transfer.totalWeight <= boarScenario.transfer.availableCapacity, "42 transfer does not exceed capacity");
check(boarScenario.transfer.transferState === "partial" && boarScenario.transfer.rejectedResources.length > 0, "43 partial leaves remainder");
check(boarScenario.carcass.remainingResources.hide.remainingQuantity === 1, "44 rejection preserves resource");
check(boarScenario.carcass.remainingResources.meat.transferredQuantity === 12, "45 quantity transfers once");
check(boarScenario.transfer.recipient.inventory.some((item) => item.itemKey === "resource.raw-game-meat" && item.weight === 12), "46 resource affects inventory weight");
check(!source.includes("speedPenalty") && !source.includes("movementPenalty"), "47 no movement penalty formula");
check(!boarScenario.transfer.recipient.inventory.some((item) => item.carcassId === boarScenario.carcass.carcassId), "48 carcass not carried in inventory");
check(arrowScenario.carcass.projectileRecoveryRecords[0].carcassId === arrowScenario.carcass.carcassId, "49 embedded projectile linked");
check(!boarScenario.hunter.ammunitionState?.spentActionTokens?.includes("processing:arrow:transfer"), "50 attack does not auto-refund");
check(arrowScenario.carcass.recoveryState === "claimed" && arrowScenario.recovered.accepted, "51 projectile requires recovered carcass");
check(arrowScenario.processingRegistry.completedProjectileIds.size === 1, "52 projectile recovered once");
check(arrowScenario.recovered.projectile.damaged && arrowScenario.transfer.recipient.inventory.some((item) => item.itemKey === "resource.damaged-arrow"), "53 damaged projectile not pristine");
check(arrowScenario.carcass.projectileRecoveryRecords.length === 1, "54 missed projectile not embedded");
check(arrowScenario.carcass.projectileRecoveryRecords.every((entry) => entry.projectileId !== "arrow:missed:1"), "55 terrain search separate");

// 56-67: contamination, spoilage, finalization, abandonment, and stale transfer.
check(Array.isArray(boarScenario.carcass.conditionProfile.contaminationTags), "56 contamination descriptive");
{
  const condition = resolveCanonicalCarcassCondition({ sourceActor: {}, contaminationTags: ["poison-exposure"] });
  check(condition.poisonExposure === true, "57 poison may block food");
}
{
  const condition = resolveCanonicalCarcassCondition({ sourceActor: {}, contaminationTags: ["disease-concern"] });
  check(condition.diseaseConcern === true && !("diagnosis" in condition), "58 no diagnosis invented");
}
check(eventCount(boarScenario, "spoilage-state-started") === 1, "59 spoilage starts once");
{
  const normalized = normalizeReferenceCombatActor({ ...boarScenario.sourceActor, spoilageState: boarScenario.carcass.spoilageState }, { source: "test" }).normalizedActor;
  check(normalized.spoilageState.startedAt === 1000, "60 spoilage survives normalization");
}
check(boarScenario.carcass.spoilageState.exactTemperatureCurve === null, "61 no spoilage curve");
check(boarScenario.encounter.outcome === "clean-kill", "62 hunting outcome stays committed");
check(!boarScenario.events.some((entry) => entry.eventType === "encounter-over" && entry.data?.finalizationOwner === "carcass-processing"), "63 no competing encounter-over");
{
  const carcass = { ...boarScenario.carcass, state: "recovered", processingState: "partially-harvested", recoveryState: "claimed", processingFinalized: false };
  check(abandonCanonicalCarcass({ carcass, actorId: boarScenario.hunter.id }).accepted && carcass.state === "abandoned", "64 abandonment ends processing");
}
check(protectedScenario.carcass.remainingResources && Object.keys(protectedScenario.carcass.remainingResources).length === 0, "65 protected resources not transferred");
check(eventCount(boarScenario, "carcass-processing-completed") === 1, "66 processing completes once");
check(!requestHarvestInventoryTransfer({
  registry: boarScenario.processingRegistry,
  processor: boarScenario.hunter, recipient: boarScenario.hunter,
  carcass: boarScenario.carcass, resources: [], capacity: 10,
  actionToken: "processing:transfer:boar", generationId: "g",
}).accepted, "67 stale transfer rejected");

// 68-80: normalization and global authority.
{
  const normalized = normalizeReferenceCombatActor({ ...boarScenario.sourceActor, carcassState: boarScenario.carcass }, { source: "test" }).normalizedActor;
  check(normalized.carcassState.carcassId === boarScenario.carcass.carcassId, "68 carcass state preserved");
}
{
  const normalized = normalizeReferenceCombatActor({ ...boarScenario.sourceActor, remainingResources: boarScenario.carcass.remainingResources }, { source: "test" }).normalizedActor;
  check(normalized.remainingResources.meat.transferredQuantity === 12, "69 ledger preserved");
}
{
  const normalized = normalizeReferenceCombatActor({ ...arrowScenario.sourceActor, projectileRecoveryRecords: arrowScenario.carcass.projectileRecoveryRecords }, { source: "test" }).normalizedActor;
  check(normalized.projectileRecoveryRecords[0].state === "transferred", "70 projectile state preserved");
}
{
  const normalized = normalizeReferenceCombatActor({ ...boarScenario.sourceActor, inventoryTransferState: boarScenario.carcass.inventoryTransferState }, { source: "test" }).normalizedActor;
  check(normalized.inventoryTransferState.transferState === "partial", "71 transfer state preserved");
}
{
  const once = normalizeReferenceCombatActor({ ...boarScenario.sourceActor, carcassState: boarScenario.carcass }, { source: "test" }).normalizedActor;
  const twice = normalizeReferenceCombatActor(once, { source: "test" }).normalizedActor;
  check(JSON.stringify(once) === JSON.stringify(twice), "72 normalization idempotent");
}
check(normalizeReferenceCombatActor(boarScenario.sourceActor, { source: "test", lifecyclePhase: "harvest-resolution" }).blocked, "73 normalization blocked mid-harvest");
check(!completeCanonicalCarcassProcessingAction({ registry: boarScenario.processingRegistry, claim: boarScenario.meat.claim.claim }).accepted, "74 duplicate completion blocked");
check(!finalizeCanonicalCarcassProcessing({ registry: boarScenario.processingRegistry, carcass: boarScenario.carcass, actionToken: "again" }).accepted, "75 duplicate finalizer blocked");
check(!source.includes("deathRound -") && boarScenario.carcass.deathRound === 1, "76 no round rollback");
check(browser.scenarios.every((scenario) => (scenario.diagnostics || []).every((entry) => entry.eventType !== "turn-key-mismatch")), "77 no turn-key mismatch");
{
  const after = abandonCanonicalCarcass({ carcass: { ...protectedScenario.carcass, state: "abandoned" }, actorId: "x" });
  check(!after.accepted, "78 no post-processing mutation");
}
check(browser.authorityDiagnostics.length === 0, "79 browser scenarios zero authority errors");
check(eventCount(boarScenario, "carcass-processing-completed") === 1, "80 exactly one post-hunt completion");

assert.equal(passed, 80);
assert.equal(Object.keys(CARCASS_PROCESSING_ACTIONS).length, 12);
assert.ok(normalizationSource.includes("harvest-inventory-transfer"));
assert.ok(panelSource.includes("Embedded projectiles:"));
assert.ok(Object.values(CANONICAL_HARVEST_RESOURCE_ITEMS).every((item) => item.tradeValue === null && item.combatProperties === null));
console.log(`Phase 3C4B carcass-processing tests passed: ${passed}`);
