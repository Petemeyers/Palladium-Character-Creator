import assert from "node:assert/strict";
import fs from "node:fs";
import { CANONICAL_RANGED_AND_REACH_WEAPON_FIXTURES, getCanonicalCombatActorDefinition, getCanonicalWeaponProfileByAlias } from "../src/data/canonicalCombatActors.js";
import { createCanonicalMinotaurTechniqueIntent, deriveCanonicalAttackModifier, validateMinotaurTechniquePrerequisites } from "../src/utils/combat/minotaurTechniqueResolver.js";
import { resolveCanonicalImpactPipeline } from "../src/utils/combat/canonicalImpactPipeline.js";
import { resolveFailedAutomatedActionTurn } from "../src/utils/combat/failedAutomatedActionTurn.js";

const minotaur = { ...structuredClone(getCanonicalCombatActorDefinition("minotaur")), id: "minotaur", team: "enemy" };
const knight = { ...structuredClone(getCanonicalCombatActorDefinition("knight")), id: "knight", team: "party", size: "medium" };
const intent = (techniqueKey, actor = minotaur, target = knight, extra = {}) => createCanonicalMinotaurTechniqueIntent({ techniqueKey, actor, target, ...extra });

const dagger = getCanonicalWeaponProfileByAlias({ name: "Dagger", range: 20 });
assert.equal(dagger.deliveryType, "melee");
assert.equal(dagger.range, null);
assert.equal(dagger.isRanged, false);
assert.equal(CANONICAL_RANGED_AND_REACH_WEAPON_FIXTURES.thrownDagger.deliveryType, "thrown");

const modifier = deriveCanonicalAttackModifier({ actor: minotaur });
assert.deepEqual(modifier.components, { attribute: 4, proficiency: 2, fatigue: 0, position: 0, reach: 0, technique: 0 });
assert.equal(modifier.total, 6);
assert.equal(minotaur.attacks.some((attack) => Number(attack.attackBonus) === 6), false, "no imported flat +6 profiles");

const axeIntent = intent("heavyAxe");
const breastplate = resolveCanonicalImpactPipeline({ intent: axeIntent, prerequisite: { accepted: true }, armor: { armorClass: "plate", rigidCoverage: true }, contact: { dented: true, bluntTransfer: 2 }, hitLocation: { location: "torso" } });
assert.equal(breastplate.bodilyDamagePermitted, false);
assert.equal(breastplate.directHpMutation, false);
assert.ok(breastplate.events.some((entry) => entry.eventType === "armor-impact-resolved"));

const gap = resolveCanonicalImpactPipeline({ intent: axeIntent, prerequisite: { accepted: true }, armor: { armorClass: "plate", rigidCoverage: true }, contact: { armorGap: true }, hitLocation: { location: "armpit" } });
assert.equal(gap.bodilyDamagePermitted, true);
assert.equal(gap.outcome, "armor-gap-contact");

const chargeIntent = intent("chargingGore", minotaur, knight, { movement: { straightLineFeet: 20 } });
assert.equal(chargeIntent.accepted, true);
const shield = resolveCanonicalImpactPipeline({ intent: chargeIntent, prerequisite: { accepted: true }, movement: { straightLineFeet: 20, momentum: 8 }, shield: { intercepted: true, shieldId: "heater", armImpact: 2 }, stability: { displacementFeet: 5 }, stamina: { spent: 6 } });
assert.equal(shield.outcome, "shield-interception");
assert.ok(shield.events.some((entry) => entry.eventType === "forced-movement-resolved"));
const chargePlate = resolveCanonicalImpactPipeline({ intent: chargeIntent, prerequisite: { accepted: true }, movement: { straightLineFeet: 20 }, armor: { armorClass: "plate", rigidCoverage: true }, contact: { bluntTransfer: 3 }, stability: { knockedDown: true } });
assert.equal(chargePlate.bodilyDamagePermitted, false);

assert.equal(intent("hornHook").reason, "horn-engagement-required");
assert.equal(intent("crush").reason, "crush-control-required");
assert.equal(intent("trample").reason, "prone-or-overrun-required");
assert.equal(intent("trample", minotaur, { ...knight, positionState: "prone" }).accepted, true);

const engaged = { ...minotaur, hornEngagement: { targetId: knight.id } };
const hook = intent("hornHook", engaged);
assert.equal(hook.accepted, true);
const liftedActor = { ...engaged, grappleState: { active: true, opponent: knight.id, control: "dominant", liftedTargetId: knight.id } };
assert.equal(intent("lift", liftedActor).accepted, true);
assert.equal(intent("slam", liftedActor).accepted, true);
assert.deepEqual(["canonical-grapple-control", "canonical-lift-contest", "fall-collision-impact"], [hook.resolverRoute, intent("lift", liftedActor).resolverRoute, intent("slam", liftedActor).resolverRoute]);

const turn = resolveFailedAutomatedActionTurn({
  fighters: [
    { id: "minotaur", remainingActions: 0, actionsPerRound: 2 },
    { id: "knight", remainingActions: 1, actionsPerRound: 2 },
  ],
  activeIndex: 1,
  round: 3,
  actorId: "knight",
});
assert.equal(turn.round, 4);
assert.equal(turn.nextIndex, 0);
assert.equal(turn.fighters[0].id, "minotaur");
assert.equal(turn.roundAdvanced, true);

const combatSource = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(combatSource, /fightersRef\.current = nextFighters;\s*setFighters\(nextFighters\);\s*[\s\S]*scheduleEndTurn\(16, "burnFailedAutomatedActionAndEnd"\)/);
assert.doesNotMatch(combatSource, /minotaur[\s\S]{0,200}attackBonus:\s*6/i);
console.log("canonical Minotaur techniques and blocker regressions passed: 30");
