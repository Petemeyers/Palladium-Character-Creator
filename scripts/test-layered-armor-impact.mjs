import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyArmorImpactToFighter,
  buildLayeredArmorImpactNarration,
  normalizeArmorAssembly,
  resolveLayeredArmorImpact,
} from "../src/utils/combat/armorAssemblyImpact.js";
import { resolveCanonicalImpactPipeline } from "../src/utils/combat/canonicalImpactPipeline.js";

let assertions = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  assertions += 1;
};
const equal = (actual, expected, message) => {
  assert.equal(actual, expected, message);
  assertions += 1;
};

const minotaur = {
  id: "minotaur-test",
  name: "Minotaur",
  size: "large",
  massKg: 360,
  attributes: { might: 19, endurance: 16 },
  abilityScores: { strength: 19, constitution: 16 },
};

const paddedKnight = {
  id: "knight-padded",
  name: "Knight",
  size: "medium",
  attributes: { might: 15, endurance: 14 },
  abilityScores: { strength: 15, constitution: 14 },
  equippedArmor: {
    id: "armor.plate-harness",
    name: "Plate Harness",
    type: "armor",
    category: "heavy",
    weight: 45,
  },
  armorProfile: { armorClass: "plate", rigidCoverage: true },
  tags: ["knight", "professional"],
};

const barePlateKnight = {
  ...paddedKnight,
  id: "knight-bare-plate",
  equippedArmor: {
    ...paddedKnight.equippedArmor,
    paddingPresent: false,
    condition: "bare-plate",
  },
};

const poorKnight = {
  ...paddedKnight,
  id: "knight-poor",
  tags: ["poor", "knight"],
  equippedArmor: {
    ...paddedKnight.equippedArmor,
    quality: "poor",
    material: "low-carbon-steel",
  },
};

const fineKnight = {
  ...paddedKnight,
  id: "knight-fine",
  tags: ["wealthy", "veteran", "knight"],
  equippedArmor: {
    ...paddedKnight.equippedArmor,
    quality: "fine",
    material: "hardened-steel",
  },
};

const rockThrow = {
  name: "Rock Throw",
  techniqueKey: "rockThrow",
  damageType: "bludgeoning",
  armorContactProfile: "improvised-heavy-projectile",
};

const paddedImpact = resolveLayeredArmorImpact({
  attacker: minotaur,
  defender: paddedKnight,
  attack: rockThrow,
  techniqueKey: "rockThrow",
  hitLocation: "head",
  attackMargin: 9,
  contactResult: { coverageType: "solid-plate" },
});
const bareImpact = resolveLayeredArmorImpact({
  attacker: minotaur,
  defender: barePlateKnight,
  attack: rockThrow,
  techniqueKey: "rockThrow",
  hitLocation: "head",
  attackMargin: 9,
  contactResult: { coverageType: "solid-plate" },
});
const poorImpact = resolveLayeredArmorImpact({
  attacker: minotaur,
  defender: poorKnight,
  attack: rockThrow,
  techniqueKey: "rockThrow",
  hitLocation: "head",
  attackMargin: 9,
  contactResult: { coverageType: "solid-plate" },
});
const fineImpact = resolveLayeredArmorImpact({
  attacker: minotaur,
  defender: fineKnight,
  attack: rockThrow,
  techniqueKey: "rockThrow",
  hitLocation: "head",
  attackMargin: 9,
  contactResult: { coverageType: "solid-plate" },
});

check(paddedImpact.accepted, "padded plate impact should resolve");
check(paddedImpact.impact.kineticEnergyJ > 0, "impact should report kinetic energy");
check(paddedImpact.impact.momentumNs > 0, "impact should report momentum");
check(paddedImpact.shell.dentDepthMm > 0, "heavy rock should dent plate");
check(paddedImpact.shell.integrityLost > 0, "heavy rock should deteriorate plate integrity");
check(paddedImpact.padding.present, "professional plate should infer fitted padding");
check(paddedImpact.padding.absorbedEnergyJ > 0, "padding should absorb impact energy");
check(paddedImpact.body.transferredEnergyJ > 0, "stopped impact must retain nonzero body transfer");
check(
  bareImpact.body.transferredEnergyJ > paddedImpact.body.transferredEnergyJ,
  "plate without padding should transfer more energy to the body",
);
check(!bareImpact.padding.present, "explicit bare plate should not invent padding");
check(bareImpact.body.noPaddingHazard, "bare plate should report a no-padding hazard");
check(
  poorImpact.shell.capacityJ < fineImpact.shell.capacityJ,
  "poor armor should have less deformation capacity than fine hardened armor",
);
check(
  poorImpact.shell.integrityLost >= fineImpact.shell.integrityLost,
  "poor armor should deteriorate at least as much as fine armor",
);
check(
  poorImpact.shell.dentDepthMm >= fineImpact.shell.dentDepthMm,
  "poor armor should dent at least as deeply as fine armor",
);

const damagedKnight = applyArmorImpactToFighter(paddedKnight, paddedImpact);
check(Boolean(damagedKnight.armorAssemblyState), "impact should persist armor assembly state");
check(
  damagedKnight.armorAssemblyState.locations.head.impacts === 1,
  "first helmet impact should increment localized impact count",
);
check(
  damagedKnight.armorAssemblyState.locations.head.deformationMm > 0,
  "helmet deformation should persist by location",
);
check(Boolean(damagedKnight.lastImpactResult?.visual), "fighter should retain renderer-ready impact data");

const repeatedImpact = resolveLayeredArmorImpact({
  attacker: minotaur,
  defender: damagedKnight,
  attack: rockThrow,
  techniqueKey: "rockThrow",
  hitLocation: "head",
  attackMargin: 9,
  contactResult: { coverageType: "solid-plate" },
});
check(
  repeatedImpact.shell.deformationBeforeMm === paddedImpact.shell.deformationAfterMm,
  "repeated impact should begin from the prior dent depth",
);
check(
  repeatedImpact.shell.capacityJ < paddedImpact.shell.capacityJ,
  "existing deformation should reduce effective shell capacity",
);

const rockSmashImpact = resolveLayeredArmorImpact({
  attacker: minotaur,
  defender: paddedKnight,
  attack: {
    name: "Rock Smash",
    techniqueKey: "rockSmash",
    damageType: "bludgeoning",
  },
  techniqueKey: "rockSmash",
  hitLocation: "torso",
  attackMargin: 6,
  contactResult: { coverageType: "solid-plate" },
});
check(rockSmashImpact.shell.dented, "Rock Smash should visibly deform plate");
check(rockSmashImpact.body.injuryAuthorized, "Rock Smash should be able to injure through plate");
check(rockSmashImpact.body.damageMultiplier > 0, "blunt transfer should produce a damage multiplier");
check(rockSmashImpact.stability.checked, "Rock Smash should require a stability result");
check(rockSmashImpact.stability.displacementFeet >= 5, "Rock Smash should be able to drive the wearer backward");

const goreImpact = resolveLayeredArmorImpact({
  attacker: minotaur,
  defender: paddedKnight,
  attack: {
    name: "Charging Gore",
    techniqueKey: "chargingGore",
    damageType: "piercing",
  },
  techniqueKey: "chargingGore",
  hitLocation: "torso",
  attackMargin: 8,
  movement: { straightLineFeet: 30 },
  contactResult: { coverageType: "solid-plate" },
});
check(goreImpact.stability.checked, "Charging Gore must resolve stability");
check(goreImpact.stability.displacementFeet >= 10, "Charging Gore should launch a medium armored target");
check(goreImpact.stability.prone, "Charging Gore should knock the target prone at high impulse");
check(goreImpact.visual.kind === "charge-collision", "Charging Gore should expose a charge visual contract");
check(goreImpact.visual.dentDepthM >= 0, "visual contract should include dent depth");
check(goreImpact.visual.impulseNewtonSeconds > 0, "visual contract should include impulse");

const unarmoredImpact = resolveLayeredArmorImpact({
  attacker: minotaur,
  defender: { id: "unarmored", name: "Unarmored Fighter", size: "medium" },
  attack: {
    name: "Gore",
    techniqueKey: "gore",
    damageType: "piercing",
  },
  techniqueKey: "gore",
  hitLocation: "torso",
  attackMargin: 5,
  contactResult: { coverageType: "unarmored" },
});
equal(unarmoredImpact.outcome, "direct-body-impact", "unarmored impacts should use direct-body outcome");
check(unarmoredImpact.body.injuryAuthorized, "Minotaur Gore should injure an unarmored body");
check(unarmoredImpact.stability.displacementFeet >= 5, "unarmored Gore should force movement");

const canonical = resolveCanonicalImpactPipeline({
  intent: {
    accepted: true,
    techniqueKey: "rockSmash",
    resolverRoute: "standard-weapon-impact",
    technique: { contactSurface: "improvised-heavy-melee", staminaCost: 1 },
    derivedAttackModifier: { total: 6, components: { attribute: 4, proficiency: 2 } },
  },
  prerequisite: { accepted: true },
  movement: { straightLineFeet: 0 },
  defense: { evaded: false },
  shield: { intercepted: false },
  hitLocation: { location: "torso" },
  armor: {
    layer: "Plate Harness",
    armorClass: "plate",
    rigidCoverage: true,
    assemblyQuality: rockSmashImpact.assembly.quality,
    paddingPresent: rockSmashImpact.padding.present,
  },
  contact: {
    armorGap: false,
    exposedLocation: false,
    penetrated: rockSmashImpact.shell.penetrated,
    dented: rockSmashImpact.shell.dented,
    buckled: rockSmashImpact.shell.condition === "buckled",
    deflected: false,
    bluntTransfer: rockSmashImpact.body.transferredEnergyJ,
    injuryAuthorized: rockSmashImpact.body.injuryAuthorized,
    injuryThresholdJ: rockSmashImpact.body.injuryThresholdJ,
    bodyDamageMultiplier: rockSmashImpact.body.damageMultiplier,
    minimumDamage: rockSmashImpact.body.minimumDamage,
    damageType: rockSmashImpact.body.damageType,
    statuses: rockSmashImpact.body.statuses,
    impact: rockSmashImpact.impact,
    shell: rockSmashImpact.shell,
    padding: rockSmashImpact.padding,
    layeredImpact: rockSmashImpact,
    contactType: "armor-dent",
  },
  stability: rockSmashImpact.stability,
  stamina: { spent: 1 },
});
check(canonical.accepted, "canonical impact pipeline should accept layered impact");
check(canonical.stageCountValid, "forced movement must preserve the committed 13-stage pipeline");
check(canonical.bodilyDamagePermitted, "nonpenetrating blunt injury should be authorized");
equal(canonical.bodyDamageMultiplier, rockSmashImpact.body.damageMultiplier, "pipeline should preserve body damage multiplier");
check(canonical.armorImpact?.visual?.rendererContractVersion === 1, "pipeline should preserve visual impact data");
equal(canonical.events.length, 13, "canonical impact pipeline should remain exactly 13 committed stages");
const stabilityEvent = canonical.events.find((entry) => entry.eventType === "stability-contest-resolved");
check(stabilityEvent?.data?.displacementFeet >= 5, "stability stage should include forced movement");
check(stabilityEvent?.data?.forcedMovementResolved, "stability stage should mark forced movement resolved");

const paddedNarration = buildLayeredArmorImpactNarration({
  impactResult: paddedImpact,
  defenderName: "the Knight",
});
check(/liner|padding|absorbs|compresses/i.test(paddedNarration), "padded narration should mention the inner layer");
const bareNarration = buildLayeredArmorImpactNarration({
  impactResult: bareImpact,
  defenderName: "the Knight",
});
check(/no effective padding/i.test(bareNarration), "bare plate narration should warn about direct force transfer");

const normalizedBare = normalizeArmorAssembly(barePlateKnight, "head");
check(!normalizedBare.paddingLayer.present, "normalization should preserve intentionally missing padding");
const normalizedFine = normalizeArmorAssembly(fineKnight, "torso");
check(normalizedFine.quality === "fine", "explicit fine armor quality should survive normalization");
check(normalizedFine.outerLayer.material === "hardened-steel", "fine armor should retain explicit hardened steel");

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), "..");
const combatPage = fs.readFileSync(path.join(projectRoot, "src/pages/CombatPage.jsx"), "utf8");
check(combatPage.includes("resolveLayeredArmorImpact"), "CombatPage should invoke the layered impact resolver");
check(combatPage.includes("applyArmorImpactToFighter"), "CombatPage should persist armor deterioration");
check(combatPage.includes("layered-armor-body-damage-scaled"), "CombatPage should scale bodily damage after armor transfer");
check(combatPage.includes("armor-assembly-impact-resolved"), "CombatPage should log the physical armor result");
check(combatPage.includes("resolveImpactForcedMovementDestination"), "CombatPage should apply canonical forced movement");
check(combatPage.includes("buildLayeredImpactContactPayload"), "CombatPage should pass layered physics into the canonical pipeline");

console.log(`Layered armor-impact tests passed: ${assertions} assertions.`);
