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

export default validateArmoredTechniqueWeapon;
