import assert from "node:assert/strict";
import {
  CANONICAL_COMBAT_ACTORS,
  CANONICAL_RANGED_AND_REACH_WEAPON_FIXTURES as W,
  getCanonicalCombatActorDefinition,
  resolveCanonicalCombatActorAlias,
} from "../src/data/canonicalCombatActors.js";
import { normalizeReferenceCombatActor } from "../src/utils/combat/normalizeCombatActorSchema.js";
import { validateCombatActor } from "../src/utils/combat/validateCombatActor.js";
import {
  claimCanonicalAmmunitionSpend,
  commitCanonicalAmmunitionSpend,
  completeCanonicalRangedReload,
  normalizeCanonicalAmmunitionState,
  validateCanonicalRangedAttack,
} from "../src/utils/combat/canonicalRangedCombat.js";
import { resolveExtendedMeleeReach } from "../src/utils/combat/resolveExtendedMeleeReach.js";
import { resolveCanonicalProjectileArmorContact } from "../src/utils/combat/projectileArmorContact.js";

let assertions = 0;
const ok = (condition, message) => { assert.ok(condition, message); assertions += 1; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); assertions += 1; };

for (const actorKey of ["archer", "longbowman", "bandit"]) {
  const actor = getCanonicalCombatActorDefinition(actorKey);
  equal(actor.actorKey, actorKey, `${actorKey} stable identity`);
  equal(actor.combatActorSchemaVersion, 1, `${actorKey} schema`);
}
ok(CANONICAL_COMBAT_ACTORS.archer.actorKey !== CANONICAL_COMBAT_ACTORS.longbowman.actorKey, "ranged identities remain separate");
equal(resolveCanonicalCombatActorAlias("Crossbowman").actorKey, null, "allowlist-only Crossbowman is not invented");
equal(resolveCanonicalCombatActorAlias("Pikeman").actorKey, null, "allowlist-only Pikeman is not invented");
equal(resolveCanonicalCombatActorAlias("Halberdier").actorKey, null, "allowlist-only Halberdier is not invented");
equal(CANONICAL_COMBAT_ACTORS.bandit.loadouts["hunting-bow-skirmisher"].heldItems.sidearm, "weapon.hand-axe", "Bandit uses carried sidearm");

for (const profile of [W.huntingBow, W.archerBow, W.longbow, W.crossbow]) {
  equal(profile.deliveryType, "projectile", `${profile.name} projectile classification`);
  ok(profile.ammunitionType && profile.armorContactProfile, `${profile.name} complete ammunition/contact profile`);
}
for (const profile of [W.pike, W.halberd, W.guardSpear, W.infantrySpear]) {
  equal(profile.deliveryType, "extended-melee", `${profile.name} extended melee classification`);
  equal(profile.ammunitionType, null, `${profile.name} has no ammunition`);
}
equal(W.longbow.reloadRequirement, "none", "bow has no crossbow reload");
equal(W.crossbow.drawRequirement, "none", "crossbow has no bow draw");
equal(W.guardSpear.handsRequired, 1, "guard spear remains one handed");
equal(W.infantrySpear.handsRequired, 2, "infantry spear remains two handed");

const archer = structuredClone(CANONICAL_COMBAT_ACTORS.archer);
archer.id = "archer-runtime";
archer.team = "party";
const target = { id: "target", team: "enemy" };
let ammo = normalizeCanonicalAmmunitionState(archer, W.archerBow);
equal(ammo.current, 20, "canonical ammunition initialized");
let admission = validateCanonicalRangedAttack({ actor: archer, target, weaponProfile: W.archerBow, ammunitionState: ammo, actionToken: "turn:1", activeActionToken: "turn:1", distanceFeet: 120, cover: 2 });
ok(admission.accepted && admission.rangeBand === "normal" && admission.cover === 2, "normal range carries cover");
admission = validateCanonicalRangedAttack({ actor: archer, target, weaponProfile: W.archerBow, ammunitionState: ammo, actionToken: "turn:1", activeActionToken: "turn:1", distanceFeet: 121, firingIntoMelee: true });
ok(admission.accepted && admission.rangeBand === "long" && admission.firingIntoMelee, "long range and melee context preserved");
equal(validateCanonicalRangedAttack({ actor: archer, target, weaponProfile: W.archerBow, ammunitionState: ammo, actionToken: "turn:1", activeActionToken: "turn:1", distanceFeet: 481 }).reason, "target-out-of-range", "out of range blocked");
equal(validateCanonicalRangedAttack({ actor: archer, target, weaponProfile: W.archerBow, ammunitionState: ammo, actionToken: "turn:1", activeActionToken: "turn:1", distanceFeet: 80, obstruction: true }).reason, "line-of-sight-blocked", "LOS blocked");
equal(validateCanonicalRangedAttack({ actor: { ...archer, surrendered: true }, target, weaponProfile: W.archerBow, ammunitionState: ammo, actionToken: "turn:1", activeActionToken: "turn:1", distanceFeet: 80 }).reason, "actor-cannot-fire", "surrendered actor blocked");
equal(validateCanonicalRangedAttack({ actor: { ...archer, grappled: true }, target, weaponProfile: W.archerBow, ammunitionState: ammo, actionToken: "turn:1", activeActionToken: "turn:1", distanceFeet: 5 }).reason, "weapon-unavailable-in-grapple", "bow blocked in grapple");

const claim = claimCanonicalAmmunitionSpend({ ammunitionState: ammo, weaponProfile: W.archerBow, actionToken: "turn:1", activeActionToken: "turn:1" });
ok(claim.accepted, "ammo claimed");
const commit = commitCanonicalAmmunitionSpend({ ammunitionState: ammo, weaponProfile: W.archerBow, claim: claim.claim });
equal(commit.ammunitionState.current, 19, "one arrow spent on accepted shot regardless of result");
equal(commitCanonicalAmmunitionSpend({ ammunitionState: commit.ammunitionState, weaponProfile: W.archerBow, claim: claim.claim }).reason, "duplicate-ammunition-spend", "duplicate callback rejected");
equal(claimCanonicalAmmunitionSpend({ ammunitionState: ammo, weaponProfile: W.archerBow, actionToken: "stale", activeActionToken: "turn:1" }).reason, "stale-action-token", "stale callback rejected");
equal(claimCanonicalAmmunitionSpend({ ammunitionState: { ...ammo, current: 0 }, weaponProfile: W.archerBow, actionToken: "turn:2", activeActionToken: "turn:2" }).reason, "ammunition-empty", "empty ammo rejected");

let crossbowAmmo = { weaponId: W.crossbow.weaponId, ammunitionType: "bolt", current: 3, maximum: 3, chambered: false, reloadState: "reload-required", lastSpentActionToken: null, spentActionTokens: [] };
equal(validateCanonicalRangedAttack({ actor: archer, target, weaponProfile: W.crossbow, ammunitionState: crossbowAmmo, actionToken: "reload:1", activeActionToken: "reload:1", distanceFeet: 50 }).reason, "reload-required", "crossbow requires reload");
const loaded = completeCanonicalRangedReload({ ammunitionState: crossbowAmmo, weaponProfile: W.crossbow, actionToken: "reload:1", activeActionToken: "reload:1" });
ok(loaded.accepted && loaded.ammunitionState.chambered, "reload persists");
const boltClaim = claimCanonicalAmmunitionSpend({ ammunitionState: loaded.ammunitionState, weaponProfile: W.crossbow, actionToken: "fire:1", activeActionToken: "fire:1" });
const boltCommit = commitCanonicalAmmunitionSpend({ ammunitionState: loaded.ammunitionState, weaponProfile: W.crossbow, claim: boltClaim.claim });
ok(!boltCommit.ammunitionState.chambered && boltCommit.ammunitionState.reloadState === "reload-required", "firing clears chamber");
equal(claimCanonicalAmmunitionSpend({ ammunitionState: ammo, weaponProfile: W.crossbow, actionToken: "bad:1", activeActionToken: "bad:1" }).reason, "ammunition-weapon-mismatch", "arrow/crossbow mismatch rejected");

const poleActor = { id: "pole", inventory: [W.pike], positionState: "standing" };
let reach = resolveExtendedMeleeReach({ attacker: poleActor, target, weaponProfile: W.pike, distanceFeet: 10, actionToken: "reach:1", activeActionToken: "reach:1", activeFighterId: "pole" });
ok(reach.legal && !reach.consumesAmmunition && !reach.usesProjectileAnimation, "valid pike is melee lifecycle");
equal(resolveExtendedMeleeReach({ attacker: poleActor, target, weaponProfile: W.pike, distanceFeet: 11, actionToken: "reach:1", activeActionToken: "reach:1" }).reason, "target-outside-reach", "maximum reach enforced");
equal(resolveExtendedMeleeReach({ attacker: poleActor, target, weaponProfile: W.pike, distanceFeet: 4, actionToken: "reach:1", activeActionToken: "reach:1" }).reason, "target-inside-minimum-reach", "defined minimum enforced");
ok(resolveExtendedMeleeReach({ attacker: { id: "h", inventory: [W.halberd] }, target, weaponProfile: W.halberd, distanceFeet: 4, actionToken: "reach:2", activeActionToken: "reach:2" }).legal, "undefined halberd minimum does not reject adjacency");
equal(resolveExtendedMeleeReach({ attacker: poleActor, target, weaponProfile: W.pike, distanceFeet: 10, obstruction: true, actionToken: "reach:1", activeActionToken: "reach:1" }).reason, "line-of-effect-blocked", "reach obstruction blocked");
equal(resolveExtendedMeleeReach({ attacker: { ...poleActor, grappled: true }, target, weaponProfile: W.pike, distanceFeet: 10, actionToken: "reach:1", activeActionToken: "reach:1" }).reason, "weapon-unavailable-in-grapple", "polearm unavailable in grapple");
equal(resolveExtendedMeleeReach({ attacker: poleActor, target, weaponProfile: W.pike, distanceFeet: 10, actionToken: "stale", activeActionToken: "reach:1" }).reason, "stale-action-token", "reach stale token blocked");

const plate = { armorClass: "plate", rigidCoverage: true };
let contact = resolveCanonicalProjectileArmorContact({ weaponProfile: W.archerBow, armor: plate, attackResult: { hit: true, natural20: true }, contact: { solidPlate: true } });
ok(contact.outcome === "solid-plate-stop" && !contact.permitsDamage && contact.criticalContinuesThroughArmor, "natural 20 still stops on intact plate");
contact = resolveCanonicalProjectileArmorContact({ weaponProfile: { ...W.longbow, armorContactProfile: "narrow-hardened-arrow" }, armor: plate, attackResult: { hit: true }, contact: { solidPlate: true } });
ok(!contact.permitsDamage, "bodkin-style profile is not guaranteed penetration");
contact = resolveCanonicalProjectileArmorContact({ weaponProfile: { ...W.crossbow, armorContactProfile: "heavy-crossbow-bolt" }, armor: plate, attackResult: { hit: true }, contact: { solidPlate: true } });
ok(!contact.permitsDamage, "heavy bolt remains conditional");
contact = resolveCanonicalProjectileArmorContact({ weaponProfile: W.longbow, armor: plate, attackResult: { hit: true }, contact: { armorGap: true } });
ok(contact.permitsDamage && contact.outcome === "armor-gap-contact", "canonical armor gap may damage");

const runtime = { id: "saved-archer", canonicalActorKey: "archer", team: "enemy", currentHP: 7, currentStamina: 9, position: { x: 4, y: 5 }, ammunitionState: { ...ammo, current: 6, maximum: 20, lastSpentActionToken: "old", spentActionTokens: ["old"] } };
const normalized = normalizeReferenceCombatActor(runtime, { source: "phase3c1b-test" }).normalizedActor;
equal(normalized.actorKey, "archer", "saved identity normalizes by stable key");
equal(normalized.currentHP, 7, "HP preserved");
equal(normalized.currentStamina, 9, "stamina preserved");
equal(normalized.position.x, 4, "position preserved");
equal(normalized.ammunitionState.current, 6, "ammo preserved");
equal(normalized.ammunitionState.lastSpentActionToken, "old", "spent token preserved");
const twice = normalizeReferenceCombatActor(normalized, { source: "phase3c1b-test-again" }).normalizedActor;
equal(twice.ammunitionState.current, 6, "normalization idempotent for ammo");
ok(normalizeReferenceCombatActor(normalized, { lifecyclePhase: "attack-resolution" }).blocked, "mid-projectile normalization blocked");
ok(validateCombatActor(normalized, { normalize: false }).valid, "canonical Archer validates without schema errors");
ok(validateCombatActor(normalizeReferenceCombatActor({ id: "legacy-longbowman", sourceActorKey: "longbowman", team: "party" }).normalizedActor, { normalize: false }).valid, "compatibility Longbowman validates identically");

console.log(`Phase 3C1B ranged/reach assertions passed: ${assertions}`);
