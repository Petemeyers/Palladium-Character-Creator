import assert from "node:assert/strict";
import fs from "node:fs";

import {
  normalizeCanonicalD20Roll,
  validateCanonicalNaturalD20,
} from "../src/utils/combat/normalizeCanonicalD20Roll.js";
import { ensureConfiguredStartingAmmo } from "../src/utils/combatAmmoManager.js";
import {
  createLogicalInitiativeKey,
  resolveAtomicRoundAdvance,
} from "../src/utils/combat/canonicalRoundAdvance.js";
import { classifyCanonicalMovementProgress } from "../src/utils/combat/canonicalMovementProgress.js";
import {
  filterLegalMinotaurTechniqueCandidates,
} from "../src/utils/combat/minotaurTechniqueResolver.js";
import { resolveCanonicalImpactPipeline } from "../src/utils/combat/canonicalImpactPipeline.js";
import {
  initializeCombatStamina,
  spendCombatStamina,
} from "../src/utils/combatStamina.js";

for (const invalid of [0, 21, 1.5, Number.NaN, "20"]) {
  assert.equal(validateCanonicalNaturalD20(invalid).ok, false);
}
assert.equal(normalizeCanonicalD20Roll(1, { modifier: 7 }).naturalRoll, 1);
assert.equal(normalizeCanonicalD20Roll(1, { modifier: 7 }).total, 8);
assert.equal(normalizeCanonicalD20Roll(20, { modifier: 7 }).naturalRoll, 20);
assert.equal(normalizeCanonicalD20Roll(20, { modifier: 7 }).total, 27);

const ammoActor = ensureConfiguredStartingAmmo({
  id: "ammo-actor",
  attacks: [
    { name: "Rock Throw", type: "ranged", maxRange: 60, ammunitionPerAttack: 0, deliveryMethod: "projectile" },
    { name: "Thrown Dagger", type: "ranged", maxRange: 20, ammunitionPerAttack: 0, deliveryType: "thrown" },
    { name: "Longbow", type: "ranged", maxRange: 150 },
    { name: "Crossbow", type: "ranged", maxRange: 100 },
  ],
  inventory: [],
});
assert.equal(ammoActor.inventory.some((item) => /^arrows?$/.test(item.name)), true);
assert.equal(ammoActor.inventory.some((item) => /^bolts?$/.test(item.name)), true);
assert.equal(ammoActor.inventory.some((item) => /rock|dagger/i.test(item.name)), false);

const generationId = "generation";
const round = 2;
const fighters = [
  { id: "minotaur", remainingActions: 1 },
  { id: "knight", remainingActions: 0 },
];
const logicalTurns = new Map([
  [
    createLogicalInitiativeKey({ generationId, round, initiativeIndex: 0, actorId: "minotaur" }),
    { state: "completed" },
  ],
  [
    createLogicalInitiativeKey({ generationId, round, initiativeIndex: 1, actorId: "knight" }),
    { state: "completed" },
  ],
]);
assert.deepEqual(
  resolveAtomicRoundAdvance({
    fighters,
    currentRound: round,
    currentInitiativeIndex: 1,
    generationId,
    logicalTurnRegistry: logicalTurns,
  }),
  { round: 3, initiativeIndex: 0, wrappedRound: true },
);

assert.equal(classifyCanonicalMovementProgress({
  distanceBefore: 120,
  distanceAfter: 75,
  origin: { x: 0, y: 0 },
  destination: { x: 9, y: 0 },
}).progressed, true);
assert.equal(classifyCanonicalMovementProgress({
  distanceBefore: 75,
  distanceAfter: 75,
  origin: { x: 9, y: 0 },
  destination: { x: 9, y: 0 },
}).progressed, false);
assert.equal(classifyCanonicalMovementProgress({
  distanceBefore: 75,
  distanceAfter: 75,
  origin: { x: 9, y: 0 },
  destination: { x: 9, y: 1 },
  tacticalPositionImproved: true,
}).progressed, true);

const minotaur = {
  id: "minotaur",
  actorKey: "minotaur",
  size: "large",
  grappleState: {},
};
const knight = { id: "knight", size: "medium", positionState: "standing" };
const candidateResult = filterLegalMinotaurTechniqueCandidates({
  actor: minotaur,
  target: knight,
  candidates: [
    { techniqueKey: "heavyAxe" },
    { techniqueKey: "hornHook" },
    { techniqueKey: "lift" },
    { techniqueKey: "slam" },
    { techniqueKey: "crush" },
    { techniqueKey: "trample" },
    { techniqueKey: "chargingGore" },
  ],
});
assert.deepEqual(candidateResult.legal.map((candidate) => candidate.techniqueKey), ["heavyAxe"]);
assert.equal(candidateResult.rejected.length, 6);

const impactIntent = {
  accepted: true,
  techniqueKey: "heavyAxe",
  resolverRoute: "standard-weapon-impact",
  technique: { contactSurface: "axe-edge-or-haft" },
  derivedAttackModifier: { total: 6, components: { attribute: 4, proficiency: 2 } },
};
const plateImpact = resolveCanonicalImpactPipeline({
  intent: impactIntent,
  prerequisite: { accepted: true },
  armor: { armorClass: "plate", rigidCoverage: true },
  contact: { contactType: "solid-plate", penetrated: false },
});
assert.equal(plateImpact.bodilyDamagePermitted, false);
assert.equal(
  plateImpact.events.some((entry) => entry.eventType === "injury-authorization-resolved" && entry.data.authorized === false),
  true,
);
const gapImpact = resolveCanonicalImpactPipeline({
  intent: impactIntent,
  prerequisite: { accepted: true },
  armor: { armorClass: "plate", rigidCoverage: true },
  contact: { contactType: "armor-gap", armorGap: true },
});
assert.equal(gapImpact.bodilyDamagePermitted, true);
const shieldedImpact = resolveCanonicalImpactPipeline({
  intent: impactIntent,
  prerequisite: { accepted: true },
  defense: { activeDefense: "block", succeeded: true },
  shield: { present: true, intercepted: true, integrity: 8 },
  armor: { armorClass: "plate", rigidCoverage: true },
  contact: { contactType: "shield", penetrated: false },
});
assert.equal(shieldedImpact.bodilyDamagePermitted, false);
assert.equal(shieldedImpact.events.some((entry) => entry.eventType === "shield-interception-resolved"), true);

let staminaActor = initializeCombatStamina({
  id: "minotaur",
  maxStamina: 30,
  currentStamina: 30,
  staminaAuthority: "combat-stamina",
});
const firstSpend = spendCombatStamina({ fighter: staminaActor, amount: 3, reason: "attack" });
assert.equal(firstSpend.previousStamina, 30);
assert.equal(firstSpend.nextStamina, 27);
staminaActor = firstSpend.updated;
const secondSpend = spendCombatStamina({ fighter: staminaActor, amount: 3, reason: "attack" });
assert.equal(secondSpend.previousStamina, 27);
assert.equal(secondSpend.nextStamina, 24);
assert.equal(secondSpend.updated.combatStamina.current, 24);

const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(combatPage, /enemyCommittedActionSequenceByTurnRef/);
assert.match(combatPage, /actionSequence/);
assert.match(combatPage, /eventType:\s*"stamina-spend-resolved"[\s\S]*?actorName:[\s\S]*?initiativeTurnId:/);
assert.doesNotMatch(combatPage, /eventType:\s*"stamina-spend-resolved"[\s\S]{0,500}?data:\s*spendResult/);
assert.match(combatPage, /eventType:\s*"failed-action-position-preserved"/);
assert.match(combatPage, /activeTechniqueImpactRef\.current = null;[\s\S]*?actionClockRef\.current\.busy = false;/);
assert.match(combatPage, /Number\(meleeRound\) < Number\(meleeRoundRef\.current\)[\s\S]*?setMeleeRound\(meleeRoundRef\.current\)/);
assert.match(combatPage, /Number\(turnCounter\) < Number\(turnCounterRef\.current\)[\s\S]*?setTurnCounter\(turnCounterRef\.current\)/);
assert.ok(
  combatPage.indexOf("armorContactResult = resolveArmorContact({") <
    combatPage.indexOf("canonicalMinotaurImpactAuthorization = resolveCanonicalImpactPipeline({"),
  "Minotaur impact authorization must consume the resolved armor-contact record",
);
assert.match(
  combatPage,
  /attackData\?\.mode \|\|[\s\S]*?canonicalMinotaurTechniqueIntent\?\.techniqueKey \|\|[\s\S]*?"longsword-cut"/,
);

console.log("browser-log stabilization repair tests passed");
