import { isLongswordWeapon } from "./weaponArmorProfiles.js";

export const CLINCH_ATTACK_MODES = Object.freeze({
  DAGGER_GAP_ATTACK: "dagger-clinch-gap-attack",
  UNARMED_ATTACK: "unarmed-clinch-attack",
});

function text(...values) {
  return values
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value).toLowerCase())
    .join(" ");
}

export function isDaggerLikeWeapon(weapon = {}) {
  return /dagger|knife|short blade/.test(text(weapon?.name, weapon?.type, weapon?.category, weapon?.weaponType));
}

export function isUnarmedLikeWeapon(weapon = {}) {
  return Boolean(
    weapon?.isFallbackUnarmed === true ||
    weapon?.isNaturalAttack === true ||
    weapon?.naturalWeapon === true ||
    /unarmed|fist|punch|kick|natural/.test(text(weapon?.name, weapon?.type, weapon?.category, weapon?.weaponType))
  );
}

export function createClinchWeaponProfile(weapon = null, actor = {}) {
  if (weapon && isDaggerLikeWeapon(weapon)) {
    const weaponName = weapon.name || "Dagger";
    return {
      ...weapon,
      id: weapon.id || weapon.weaponId || weaponName,
      weaponId: weapon.weaponId || weapon.id || weaponName,
      sourceWeaponId: weapon.sourceWeaponId || weapon.weaponId || weapon.id || weaponName,
      sourceWeaponName: weapon.sourceWeaponName || weaponName,
      name: weaponName,
      damage: weapon.damage || weapon.damageDice || "1d4",
      damageDice: weapon.damageDice || weapon.damage || "1d4",
      damageType: weapon.damageType || "piercing",
      usableInClinch: true,
      attackMode: CLINCH_ATTACK_MODES.DAGGER_GAP_ATTACK,
      armorTechnique: null,
      selectedTechnique: null,
      sourceWeapon: null,
      sourceWeaponSnapshot: null,
      armoredActionPlan: null,
      armorContactTraits: {
        armorContactResolverRequired: true,
        gapCapableModes: [CLINCH_ATTACK_MODES.DAGGER_GAP_ATTACK],
      },
    };
  }

  const unarmedDamage = actor?.unarmedDamage || actor?.unarmedDamageDice || weapon?.damage || weapon?.damageDice || "1d4";
  return {
    id: weapon?.id || weapon?.weaponId || "unarmed-clinch-attack",
    weaponId: weapon?.weaponId || weapon?.id || "Unarmed Attack",
    sourceWeaponId: "Unarmed Attack",
    sourceWeaponName: "Unarmed Attack",
    name: "Unarmed Attack",
    damage: unarmedDamage,
    damageDice: unarmedDamage,
    damageType: weapon?.damageType || "blunt",
    count: 1,
    range: 5,
    rangeFeet: 5,
    reach: 5,
    reachFeet: 5,
    attackType: "melee",
    type: "melee",
    category: "unarmed",
    isMelee: true,
    isNaturalAttack: true,
    naturalWeapon: true,
    usableInClose: true,
    usableInClinch: true,
    isFallbackUnarmed: true,
    attackMode: CLINCH_ATTACK_MODES.UNARMED_ATTACK,
    armorTechnique: null,
    selectedTechnique: null,
    sourceWeapon: null,
    sourceWeaponSnapshot: null,
    armoredActionPlan: null,
    armorContactTraits: {
      armorContactResolverRequired: true,
      gapCapableModes: [],
    },
  };
}

export function validateClinchWeaponProfile(profile = {}) {
  const mode = profile?.attackMode;
  const isClinchMode = mode === CLINCH_ATTACK_MODES.DAGGER_GAP_ATTACK || mode === CLINCH_ATTACK_MODES.UNARMED_ATTACK;
  if (!isClinchMode) return { ok: false, reason: "not-clinch-mode", profile };
  const longSwordSource = Boolean(
    isLongswordWeapon(profile) ||
    isLongswordWeapon(profile?.sourceWeapon) ||
    isLongswordWeapon(profile?.sourceWeaponSnapshot) ||
    /longsword|long sword/.test(text(profile?.sourceWeaponId, profile?.sourceWeaponName, profile?.originalWeaponName))
  );
  if (longSwordSource) return { ok: false, reason: "long-sword-source-in-clinch", profile };
  const staleTechnique = /longsword|half-sword|pommel|crossguard/.test(text(profile?.selectedTechnique, profile?.armorTechnique));
  if (staleTechnique) return { ok: false, reason: "standing-technique-in-clinch", profile };
  if (!profile?.damage) return { ok: false, reason: "missing-clinch-damage", profile };
  return { ok: true, reason: "valid-clinch-profile", profile };
}

export function stripStandingAttackFieldsForClinch(actor = {}, weaponProfile = null) {
  const next = { ...(actor || {}) };
  delete next.selectedAttack;
  delete next.selectedWeapon;
  delete next.armoredActionPlan;
  delete next.armorTechnique;
  delete next.selectedTechnique;
  delete next.sourceWeapon;
  delete next.sourceWeaponSnapshot;
  if (weaponProfile) {
    next.selectedAttack = weaponProfile;
  }
  return next;
}

export default {
  CLINCH_ATTACK_MODES,
  createClinchWeaponProfile,
  isDaggerLikeWeapon,
  isUnarmedLikeWeapon,
  stripStandingAttackFieldsForClinch,
  validateClinchWeaponProfile,
};
