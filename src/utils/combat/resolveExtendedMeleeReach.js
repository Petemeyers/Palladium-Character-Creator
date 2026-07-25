const key = (value) => String(value || "").trim().toLowerCase();
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function resolveExtendedMeleeReach({
  attacker = {},
  target = {},
  weaponProfile = {},
  distanceFeet,
  obstruction = false,
  actionToken,
  activeActionToken,
  activeFighterId,
} = {}) {
  const reject = (reason) => ({ legal: false, reason, usesProjectileAnimation: false, consumesAmmunition: false });
  if (key(weaponProfile.deliveryType) !== "extended-melee") return reject("invalid-delivery-type");
  if (!actionToken || (activeActionToken && actionToken !== activeActionToken)) return reject("stale-action-token");
  if (activeFighterId && String(attacker.id) !== String(activeFighterId)) return reject("actor-not-active-fighter");
  if (!attacker.id || !target.id) return reject("invalid-combatant");
  if (weaponProfile.dropped || !(attacker.inventory || attacker.weaponProfiles || []).some((item) => (item.weaponId || item.profileKey || item.id) === weaponProfile.weaponId)) return reject("weapon-dropped");
  if (attacker.grappleState?.active || attacker.grappled || attacker.isGrappling) return reject("weapon-unavailable-in-grapple");
  if (attacker.positionState === "ground" || attacker.prone) return reject("weapon-unavailable-on-ground");
  if (obstruction) return reject("line-of-effect-blocked");
  const distance = finite(distanceFeet, Infinity);
  const minimum = finite(weaponProfile.minimumEffectiveReachFeet, 0);
  const maximum = finite(weaponProfile.reachFeet ?? weaponProfile.reach, 5);
  if (distance < minimum) return reject("target-inside-minimum-reach");
  if (distance > maximum) return reject("target-outside-reach");
  return {
    legal: true,
    reason: null,
    deliveryType: "extended-melee",
    actionToken,
    attackerId: attacker.id,
    targetId: target.id,
    distanceFeet: distance,
    minimumEffectiveReachFeet: minimum,
    maximumReachFeet: maximum,
    usesProjectileAnimation: false,
    consumesAmmunition: false,
  };
}

export default resolveExtendedMeleeReach;
