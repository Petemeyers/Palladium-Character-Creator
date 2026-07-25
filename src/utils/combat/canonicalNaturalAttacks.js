const text = (value) => String(value || "").trim().toLowerCase();

export const NATURAL_ATTACK_MANUFACTURED_FIELDS = Object.freeze([
  "weaponId",
  "sourceWeaponId",
  "sourceWeaponName",
  "sourceWeapon",
  "sourceWeaponSnapshot",
  "handedness",
  "handsRequired",
  "requiresTwoHands",
  "twoHanded",
  "ammunition",
  "ammunitionType",
  "ammunitionPerAttack",
  "reloadRequirement",
  "drawRequirement",
  "lengthFt",
  "weaponLengthFt",
  "armorTechnique",
  "selectedTechnique",
  "armorTechniqueCompatibility",
  "shieldCompatibility",
]);

export function isCanonicalNaturalAttack(profile = {}) {
  return profile.naturalWeapon === true
    || profile.isNaturalAttack === true
    || text(profile.deliveryType) === "natural";
}

export function sanitizeCanonicalNaturalAttack(profile = {}) {
  if (!isCanonicalNaturalAttack(profile)) return { ...profile };
  const sanitized = { ...profile };
  NATURAL_ATTACK_MANUFACTURED_FIELDS.forEach((field) => delete sanitized[field]);
  return {
    ...sanitized,
    id: sanitized.id || sanitized.profileKey || `natural.${sanitized.attackKey || "unknown"}`,
    profileKey: sanitized.profileKey || sanitized.id || `natural.${sanitized.attackKey || "unknown"}`,
    deliveryType: "natural",
    naturalWeapon: true,
    isNaturalAttack: true,
    manufacturedWeapon: false,
    isRanged: false,
    isMelee: true,
    droppable: false,
    lootable: false,
  };
}

export function getNaturalAttackAnatomyRejection(actor = {}, profile = {}) {
  if (!isCanonicalNaturalAttack(profile)) return null;
  const anatomy = actor.anatomyProfile || {};
  const source = text(profile.anatomySource);
  const type = text(profile.naturalWeaponType);
  if (!profile.anatomySource) return "natural-attack-missing-anatomy-source";
  if ((source === "mouth" || type === "bite") && anatomy.mouthAvailable !== true) return "mouth-unavailable";
  if ((source === "claws" || type === "claw") && anatomy.clawsPresent !== true) return "claws-unavailable";
  if ((source === "horns" || type === "horn") && anatomy.hornsPresent !== true) return "horns-unavailable";
  if ((source === "tusks" || type === "tusk" || type === "gore") && anatomy.tusksPresent !== true && anatomy.hornsPresent !== true) return "gore-anatomy-unavailable";
  if ((source === "hooves" || type === "hoof" || type === "kick") && anatomy.hoovesPresent !== true) return "hooves-unavailable";
  return null;
}

export function resolveCanonicalNaturalAttack({
  actor,
  attackKey,
  actionToken,
  initiativeTurnId,
  prerequisitesSatisfied = [],
} = {}) {
  const profiles = actor?.naturalAttackProfiles || actor?.weaponProfiles || actor?.attacks || [];
  const profile = profiles.find((candidate) => (
    candidate.attackKey === attackKey
    || candidate.profileKey === attackKey
    || candidate.id === attackKey
  ));
  if (!profile || !isCanonicalNaturalAttack(profile)) {
    return { accepted: false, reason: "natural-attack-profile-missing", events: [] };
  }
  if (!actionToken || !initiativeTurnId) {
    return { accepted: false, reason: "natural-attack-action-ownership-required", events: [] };
  }
  const anatomyReason = getNaturalAttackAnatomyRejection(actor, profile);
  if (anatomyReason) {
    return {
      accepted: false,
      reason: anatomyReason,
      events: [{ eventType: "natural-attack-prerequisite-rejected", actorId: actor?.id, data: { attackKey: profile.attackKey, actionToken, initiativeTurnId, reason: anatomyReason } }],
    };
  }
  const satisfied = new Set(prerequisitesSatisfied);
  const missingPrerequisite = (profile.prerequisites || []).find((item) => !satisfied.has(item));
  if (missingPrerequisite) {
    return {
      accepted: false,
      reason: "natural-attack-prerequisite-missing",
      events: [{ eventType: "natural-attack-prerequisite-rejected", actorId: actor?.id, data: { attackKey: profile.attackKey, actionToken, initiativeTurnId, prerequisite: missingPrerequisite } }],
    };
  }
  const canonicalProfile = sanitizeCanonicalNaturalAttack(profile);
  return {
    accepted: true,
    profile: canonicalProfile,
    actionToken,
    initiativeTurnId,
    events: [{ eventType: "natural-attack-impact-entered", actorId: actor?.id, data: { attackKey: canonicalProfile.attackKey, profileKey: canonicalProfile.profileKey, actionToken, initiativeTurnId } }],
  };
}

export function completeCanonicalNaturalAttackImpact({ actorId, targetId, profile, actionToken, initiativeTurnId, committed }) {
  return {
    eventType: committed ? "natural-attack-impact-completed" : "natural-attack-impact-rejected",
    actorId,
    targetId,
    data: { attackKey: profile?.attackKey, profileKey: profile?.profileKey, actionToken, initiativeTurnId },
  };
}

export function canDropCombatProfile(profile = {}) {
  return !isCanonicalNaturalAttack(profile) && profile.droppable !== false;
}

export function getExplicitAnimalPackIdentity(actor = {}) {
  return actor.packId || actor.groupId || actor.factionId || actor.armyId || null;
}

export function isHumanoidSurrenderAllowedForActor(actor = {}) {
  if (text(actor.creatureType) !== "animal") return true;
  return actor.surrenderProfile?.mayOfferSurrender === true
    && actor.surrenderProfile?.opensHumanoidDecisionPanel === true;
}

export default {
  canDropCombatProfile,
  completeCanonicalNaturalAttackImpact,
  getExplicitAnimalPackIdentity,
  getNaturalAttackAnatomyRejection,
  isCanonicalNaturalAttack,
  isHumanoidSurrenderAllowedForActor,
  resolveCanonicalNaturalAttack,
  sanitizeCanonicalNaturalAttack,
};
