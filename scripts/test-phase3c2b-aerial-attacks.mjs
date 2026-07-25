import assert from "node:assert/strict";
import fs from "node:fs";
import { getCanonicalCombatActorDefinition } from "../src/data/canonicalCombatActors.js";
import {
  authorizeAirborneNaturalAttack,
  createCanonicalFlightState,
} from "../src/utils/combat/canonicalFlightState.js";
import {
  getNaturalAttackAnatomyRejection,
  resolveCanonicalNaturalAttack,
} from "../src/utils/combat/canonicalNaturalAttacks.js";
import { resolveCanonicalImpactPipeline } from "../src/utils/combat/canonicalImpactPipeline.js";
import { resolveGrappleWeaponDisposition } from "../src/utils/combat/grappleWeaponTransitions.js";
import { validateCombatActor } from "../src/utils/combat/validateCombatActor.js";

let assertions = 0;
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); assertions += 1; };
const check = (value, message) => { assert.ok(value, message); assertions += 1; };

const hawkDefinition = getCanonicalCombatActorDefinition("hawk");
const falconDefinition = getCanonicalCombatActorDefinition("falcon");
const profile = hawkDefinition.naturalAttackProfiles[0];
equal(profile.attackKey, "hawk-talon-rake");
equal(profile.damage, "1d4");
equal(profile.damageType, "slashing");
equal(profile.anatomySource, "talons");
equal(profile.weaponId, undefined);
equal(profile.handedness, undefined);
equal(profile.ammunitionType, undefined);
equal(profile.droppable, false);
equal(getNaturalAttackAnatomyRejection({ anatomyProfile: { talonsPresent: false } }, profile), "talons-unavailable");
equal(getNaturalAttackAnatomyRejection(hawkDefinition, profile), null);
equal(falconDefinition.naturalAttackProfiles[0].attackBonus, 2);

const owner = { generationId: "g2", initiativeTurnId: "g2:r1:hawk", actionToken: "g2:r1:hawk:a1" };
const lowHawk = {
  ...hawkDefinition,
  id: "hawk:low",
  flightState: createCanonicalFlightState({ mode: "airborne", altitudeFeet: 5, horizontalPosition: { x: 1, y: 1 } }),
};
const guard = { ...getCanonicalCombatActorDefinition("guard"), id: "guard:1", flightState: createCanonicalFlightState({ mode: "grounded", altitudeFeet: 0 }) };
const lowAttack = authorizeAirborneNaturalAttack({ actor: lowHawk, target: guard, profile, ...owner, horizontalDistanceFeet: 0 });
equal(lowAttack.accepted, true);
equal(lowAttack.events[0].eventType, "airborne-attack-authorized");
const highHawk = { ...lowHawk, flightState: createCanonicalFlightState({ mode: "airborne", altitudeFeet: 35, horizontalPosition: { x: 1, y: 1 } }) };
const highAttack = authorizeAirborneNaturalAttack({ actor: highHawk, target: guard, profile, ...owner, horizontalDistanceFeet: 0 });
equal(highAttack.accepted, false);
equal(highAttack.reason, "target-outside-aerial-reach");
const noOwner = authorizeAirborneNaturalAttack({ actor: lowHawk, target: guard, profile });
equal(noOwner.reason, "airborne-attack-action-ownership-required");
const impactEntry = resolveCanonicalNaturalAttack({ actor: lowHawk, attackKey: profile.attackKey, initiativeTurnId: owner.initiativeTurnId, actionToken: owner.actionToken });
equal(impactEntry.accepted, true);
equal(impactEntry.events[0].eventType, "natural-attack-impact-entered");

const shieldImpact = resolveCanonicalImpactPipeline({
  intent: { accepted: true, techniqueKey: profile.attackKey, resolverRoute: "standard-natural-impact", technique: { staminaCost: 0, contactSurface: "talon" } },
  prerequisite: { accepted: true },
  shield: { intercepted: true },
  armor: { armorClass: "plate", rigidCoverage: true },
  contact: { penetrated: false },
});
equal(shieldImpact.bodilyDamagePermitted, false);
check(shieldImpact.events.findIndex((event) => event.eventType === "shield-interception-resolved") < shieldImpact.events.findIndex((event) => event.eventType === "injury-authorization-resolved"));
const plateImpact = resolveCanonicalImpactPipeline({
  intent: { accepted: true, techniqueKey: profile.attackKey, resolverRoute: "standard-natural-impact", technique: { staminaCost: 0, contactSurface: "talon" } },
  prerequisite: { accepted: true },
  shield: { intercepted: false },
  armor: { armorClass: "plate", rigidCoverage: true },
  contact: { penetrated: false },
});
equal(plateImpact.bodilyDamagePermitted, false);
const naturalTwenty = resolveCanonicalImpactPipeline({
  intent: { accepted: true, techniqueKey: profile.attackKey, resolverRoute: "standard-natural-impact", technique: { staminaCost: 0, contactSurface: "talon" } },
  prerequisite: { accepted: true },
  shield: { intercepted: false },
  armor: { armorClass: "plate", rigidCoverage: true },
  contact: { penetrated: false, naturalTwenty: true },
});
check(naturalTwenty.events.some((event) => event.eventType === "injury-authorization-resolved"), "natural 20 still reaches armor authority");

const syntheticSwoop = authorizeAirborneNaturalAttack({
  actor: highHawk,
  target: guard,
  profile: { ...profile, requiresMovement: true },
  ...owner,
});
equal(syntheticSwoop.accepted, false);
equal(syntheticSwoop.reason, "swoop-profile-missing");
const validation = validateCombatActor({ ...hawkDefinition, id: "hawk:valid", team: "enemy" }, { normalize: false });
equal(validation.valid, true);
const grapple = resolveGrappleWeaponDisposition({ fighter: lowHawk, readyWeapon: profile, position: { x: 1, y: 1 }, initiativeTurnId: owner.initiativeTurnId, actionToken: owner.actionToken });
equal(grapple.disposition, "natural-attacks-retained");
equal(grapple.droppedItemRecord, null);

const combatSource = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
check(combatSource.includes("resolveCanonicalNaturalAttack({"), "live natural attack uses canonical impact entry");
const flyingAiSource = fs.readFileSync(new URL("../src/utils/ai/flyingBehaviorSystem.js", import.meta.url), "utf8");
check(flyingAiSource.includes("swoop-profile-missing"), "AI filters invented swoop");
const flightActionsSource = fs.readFileSync(new URL("../src/utils/flightActions.js", import.meta.url), "utf8");
check(flightActionsSource.includes("ordinary-flying-animal-carrying-deferred"), "ordinary flyer carrying is excluded");

console.log(`Phase 3C2B aerial-attack tests passed: ${assertions}`);
