import {
  getWeaponArmorTraits,
  isLongswordWeapon,
  LONGSWORD_ATTACK_MODES,
} from "./weaponArmorProfiles.js";

const LONGSWORD_TECHNIQUES = new Set([
  LONGSWORD_ATTACK_MODES.CUT,
  LONGSWORD_ATTACK_MODES.THRUST,
  LONGSWORD_ATTACK_MODES.HALF_SWORD_THRUST,
  LONGSWORD_ATTACK_MODES.POMMEL_OR_CROSSGUARD_STRIKE,
]);

export function isArmoredLongswordTechnique(technique) {
  return LONGSWORD_TECHNIQUES.has(String(technique || ""));
}

export function getArmoredTechniqueSourceWeapon(planOrAttack = {}, fallbackWeapon = null) {
  return (
    planOrAttack?.sourceWeaponSnapshot ||
    planOrAttack?.sourceWeapon ||
    planOrAttack?.armoredActionPlan?.sourceWeaponSnapshot ||
    planOrAttack?.armoredActionPlan?.sourceWeapon ||
    fallbackWeapon ||
    planOrAttack
  );
}

export function validateArmoredTechniqueWeapon({
  selectedTechnique,
  sourceWeapon,
  activeGrappleState = null,
} = {}) {
  const technique = String(selectedTechnique || "");
  if (!technique) return { ok: true, reason: "no-technique" };
  if (technique === "grapple") return { ok: true, reason: "grapple-routes-to-grapple-system" };
  if (activeGrappleState?.active && isArmoredLongswordTechnique(technique)) {
    return { ok: false, reason: "active-grapple" };
  }
  if (!isArmoredLongswordTechnique(technique)) return { ok: true, reason: "non-longsword-technique" };
  if (!isLongswordWeapon(sourceWeapon)) {
    return { ok: false, reason: "incompatible-source-weapon" };
  }
  const traits = getWeaponArmorTraits(sourceWeapon);
  if (technique === LONGSWORD_ATTACK_MODES.CUT && traits.edgeAgainstPlate === "none") {
    return { ok: false, reason: "longsword-edge-not-capable" };
  }
  if (technique === LONGSWORD_ATTACK_MODES.THRUST && traits.thrustAgainstPlate === "none") {
    return { ok: false, reason: "longsword-thrust-not-capable" };
  }
  if (technique === LONGSWORD_ATTACK_MODES.HALF_SWORD_THRUST && traits.halfSwordCapable !== true) {
    return { ok: false, reason: "half-sword-not-capable" };
  }
  if (technique === LONGSWORD_ATTACK_MODES.POMMEL_OR_CROSSGUARD_STRIKE && traits.pommelStrikeCapable !== true) {
    return { ok: false, reason: "pommel-strike-not-capable" };
  }
  return { ok: true, reason: "compatible-source-weapon" };
}

const getRuntimeWeaponId = (weapon = {}) =>
  weapon?.weaponId || weapon?.id || weapon?.key || weapon?.name || null;

export function validateArmoredPlanRuntimeWeaponIdentity({
  plan = null,
  runtimeWeapon = null,
  runtimeAttackMode = null,
} = {}) {
  if (!plan) return { ok: false, reason: "missing-armored-action-plan" };
  if (!runtimeWeapon) return { ok: false, reason: "missing-runtime-weapon" };
  const expectedWeaponId = plan.sourceWeaponId || plan.sourceWeaponName || null;
  const actualWeaponId = getRuntimeWeaponId(runtimeWeapon);
  const expectedWeaponName = String(plan.sourceWeaponName || "").trim();
  const actualWeaponName = String(runtimeWeapon.name || runtimeWeapon.weaponName || "").trim();
  const expectedAttackMode = String(plan.resolvedAttackMode || plan.selectedTechnique || "").trim();
  const actualAttackMode = String(runtimeAttackMode || "").trim();
  if (String(actualWeaponId || "") !== String(expectedWeaponId || "")) {
    return { ok: false, reason: "runtime-source-weapon-id-mismatch", expected: expectedWeaponId, actual: actualWeaponId };
  }
  if (actualWeaponName !== expectedWeaponName) {
    return { ok: false, reason: "runtime-source-weapon-name-mismatch", expected: expectedWeaponName, actual: actualWeaponName };
  }
  if (actualAttackMode !== expectedAttackMode) {
    return { ok: false, reason: "runtime-attack-mode-mismatch", expected: expectedAttackMode, actual: actualAttackMode };
  }
  if (String(actualWeaponName).toLowerCase() === "unarmed attack" && isArmoredLongswordTechnique(expectedAttackMode)) {
    return { ok: false, reason: "unarmed-cannot-consume-longsword-technique" };
  }
  return { ok: true, reason: "runtime-weapon-identity-matched" };
}

export default validateArmoredTechniqueWeapon;
