import assert from "node:assert/strict";
import fs from "node:fs";
import { getCanonicalCombatActorDefinition } from "../src/data/canonicalCombatActors.js";
import { resolveCanonicalImpactPipeline } from "../src/utils/combat/canonicalImpactPipeline.js";
import {
  canDropCombatProfile,
  completeCanonicalNaturalAttackImpact,
  getNaturalAttackAnatomyRejection,
  resolveCanonicalNaturalAttack,
  sanitizeCanonicalNaturalAttack,
} from "../src/utils/combat/canonicalNaturalAttacks.js";
import { resolveGrappleWeaponDisposition } from "../src/utils/combat/grappleWeaponTransitions.js";
import { validateCombatActor } from "../src/utils/combat/validateCombatActor.js";

let assertions = 0;
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); assertions += 1; };
const check = (value, message) => { assert.ok(value, message); assertions += 1; };

const wolf = { ...getCanonicalCombatActorDefinition("wolf"), id: "wolf:test", team: "enemy" };
const boar = { ...getCanonicalCombatActorDefinition("boar"), id: "boar:test", team: "enemy" };
const horse = { ...getCanonicalCombatActorDefinition("warhorse"), id: "horse:test", team: "enemy" };
const bear = { ...getCanonicalCombatActorDefinition("bear"), id: "bear:test", team: "enemy" };

for (const actor of [wolf, boar, horse, bear]) {
  for (const profile of actor.naturalAttackProfiles) {
    equal(profile.deliveryType, "natural");
    equal(profile.manufacturedWeapon, false);
    equal(profile.droppable, false);
    equal(canDropCombatProfile(profile), false);
    equal(profile.weaponId, undefined);
    equal(profile.handedness, undefined);
    equal(profile.handsRequired, undefined);
    equal(profile.ammunitionType, undefined);
    equal(profile.lengthFt, undefined);
    check(profile.anatomySource, `${profile.name} has anatomySource`);
  }
}

equal(getNaturalAttackAnatomyRejection({ anatomyProfile: { mouthAvailable: false } }, wolf.naturalAttackProfiles[0]), "mouth-unavailable");
equal(getNaturalAttackAnatomyRejection({ anatomyProfile: { clawsPresent: false, mouthAvailable: true } }, bear.naturalAttackProfiles[0]), "claws-unavailable");
equal(getNaturalAttackAnatomyRejection({ anatomyProfile: { tusksPresent: false, hornsPresent: false, mouthAvailable: true } }, boar.naturalAttackProfiles[0]), "gore-anatomy-unavailable");
equal(getNaturalAttackAnatomyRejection({ anatomyProfile: { hoovesPresent: false, mouthAvailable: true } }, horse.naturalAttackProfiles[0]), "hooves-unavailable");

const poisoned = sanitizeCanonicalNaturalAttack({
  ...wolf.naturalAttackProfiles[0],
  weaponId: "weapon.long-sword",
  handedness: "two-handed",
  handsRequired: 2,
  ammunitionType: "arrow",
  lengthFt: 10,
  armorTechniqueCompatibility: ["half-sword-thrust"],
});
equal(poisoned.weaponId, undefined);
equal(poisoned.handedness, undefined);
equal(poisoned.handsRequired, undefined);
equal(poisoned.ammunitionType, undefined);
equal(poisoned.lengthFt, undefined);
equal(poisoned.armorTechniqueCompatibility, undefined);

const missingOwner = resolveCanonicalNaturalAttack({ actor: wolf, attackKey: "wolf-bite" });
equal(missingOwner.accepted, false);
equal(missingOwner.reason, "natural-attack-action-ownership-required");
const admitted = resolveCanonicalNaturalAttack({ actor: wolf, attackKey: "wolf-bite", initiativeTurnId: "turn:1", actionToken: "turn:1:action:1" });
equal(admitted.accepted, true);
equal(admitted.actionToken, "turn:1:action:1");
equal(admitted.events[0].eventType, "natural-attack-impact-entered");
const completion = completeCanonicalNaturalAttackImpact({ actorId: wolf.id, targetId: "guard", profile: admitted.profile, initiativeTurnId: admitted.initiativeTurnId, actionToken: admitted.actionToken, committed: true });
equal(completion.eventType, "natural-attack-impact-completed");
equal(completion.data.actionToken, admitted.actionToken);

const gatedBoar = {
  ...boar,
  naturalAttackProfiles: [{ ...boar.naturalAttackProfiles[0], prerequisites: ["movement-path"] }],
};
const chargeRejected = resolveCanonicalNaturalAttack({ actor: gatedBoar, attackKey: "boar-tusk-charge", initiativeTurnId: "turn:2", actionToken: "turn:2:action:1" });
equal(chargeRejected.accepted, false);
equal(chargeRejected.events[0].eventType, "natural-attack-prerequisite-rejected");
const charge = resolveCanonicalNaturalAttack({ actor: boar, attackKey: "boar-tusk-charge", initiativeTurnId: "turn:2", actionToken: "turn:2:action:1", prerequisitesSatisfied: ["movement-path"] });
equal(charge.accepted, true);
equal(charge.profile.damageType, "piercing");
equal(horse.naturalAttackProfiles[0].damageType, "bludgeoning");

const grapple = resolveGrappleWeaponDisposition({ fighter: wolf, readyWeapon: wolf.naturalAttackProfiles[0], position: { x: 1, y: 1 }, initiativeTurnId: "turn:3", actionToken: "turn:3:action:1" });
equal(grapple.disposition, "natural-attacks-retained");
equal(grapple.droppedItemRecord, null);
equal(grapple.droppedWeaponId, null);

const plateIntent = {
  accepted: true,
  techniqueKey: "wolf-bite",
  resolverRoute: "standard-natural-impact",
  derivedAttackModifier: {},
  technique: { staminaCost: 0, contactSurface: "bite" },
};
const shieldStop = resolveCanonicalImpactPipeline({ intent: plateIntent, prerequisite: { accepted: true }, shield: { intercepted: true }, armor: { armorClass: "plate", rigidCoverage: true } });
equal(shieldStop.events.findIndex((event) => event.eventType === "shield-interception-resolved") < shieldStop.events.findIndex((event) => event.eventType === "injury-authorization-resolved"), true);
equal(shieldStop.bodilyDamagePermitted, false);
const plateStop = resolveCanonicalImpactPipeline({ intent: plateIntent, prerequisite: { accepted: true }, shield: { intercepted: false }, armor: { armorClass: "plate", rigidCoverage: true }, contact: { penetrated: false } });
equal(plateStop.bodilyDamagePermitted, false, "bite does not bypass intact plate");
equal(plateStop.events.at(-1).eventType, "injury-authorization-resolved");
const clawStop = resolveCanonicalImpactPipeline({ intent: { ...plateIntent, techniqueKey: "bear-claw", technique: { staminaCost: 0, contactSurface: "claw" } }, prerequisite: { accepted: true }, shield: { intercepted: false }, armor: { armorClass: "plate", rigidCoverage: true }, contact: { penetrated: false } });
equal(clawStop.bodilyDamagePermitted, false, "claw does not bypass intact plate");
const gap = resolveCanonicalImpactPipeline({ intent: plateIntent, prerequisite: { accepted: true }, shield: { intercepted: false }, armor: { armorClass: "plate", rigidCoverage: true }, contact: { armorGap: true } });
equal(gap.bodilyDamagePermitted, true);
equal(gap.events.at(-1).data.authorized, true, "HP authority comes after contact");

const invalid = validateCombatActor({
  ...wolf,
  anatomyProfile: { ...wolf.anatomyProfile, mouthAvailable: false },
  naturalAttackProfiles: wolf.naturalAttackProfiles,
  weaponProfiles: wolf.naturalAttackProfiles,
  attacks: wolf.naturalAttackProfiles,
}, { normalize: false });
check(invalid.errors.some((error) => error.code === "natural-attack-invalid-anatomy"), "validator rejects unavailable anatomy");

const combatPageSource = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
check(combatPageSource.includes("resolveCanonicalNaturalAttack({"), "live attack entry resolves canonical natural profile");
check(combatPageSource.includes("natural-attack-blocked:"), "live attack entry blocks rejected anatomy before roll");
check(combatPageSource.includes("completeCanonicalNaturalAttackImpact({"), "live finalizer emits canonical natural-impact completion");

console.log(`Phase 3C2A natural-attack tests passed: ${assertions}`);
