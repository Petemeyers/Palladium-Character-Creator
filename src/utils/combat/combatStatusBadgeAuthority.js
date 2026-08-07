import { isWeaponConditionActive, WEAPON_CONDITION_TYPES } from "./weaponConditionAuthority.js";
import { getShieldIntegrity, SHIELD_INTEGRITY_STATES } from "./shieldIntegrityAuthority.js";

const normalizeText = (value) => String(value ?? "").trim().toLowerCase().replaceAll("_", "-");

const CONDITION_BADGES = Object.freeze({
  [WEAPON_CONDITION_TYPES.OFF_BALANCE]: Object.freeze({ key: "off-balance", label: "OB", title: "Off balance", fill: "#b45309" }),
  [WEAPON_CONDITION_TYPES.GUARD_DISRUPTED]: Object.freeze({ key: "guard-disrupted", label: "GD", title: "Guard disrupted", fill: "#c2410c" }),
  [WEAPON_CONDITION_TYPES.SHIELD_BOUND]: Object.freeze({ key: "shield-bound", label: "SB", title: "Shield or weapon line bound", fill: "#7c3aed" }),
  [WEAPON_CONDITION_TYPES.WEAPON_POINT_DISPLACED]: Object.freeze({ key: "point-displaced", label: "PD", title: "Weapon point displaced", fill: "#0369a1" }),
  [WEAPON_CONDITION_TYPES.FORMATION_DISRUPTED]: Object.freeze({ key: "formation-disrupted", label: "FD", title: "Formation disrupted", fill: "#be123c" }),
  [WEAPON_CONDITION_TYPES.WEAPON_BOUND]: Object.freeze({ key: "weapon-bound", label: "BD", title: "Weapon bound", fill: "#6d28d9" }),
  [WEAPON_CONDITION_TYPES.FORMATION_ANCHORED]: Object.freeze({ key: "formation-anchored", label: "AN", title: "Formation anchored", fill: "#166534" }),
});

export const getCombatStatusBadges = ({ actor, currentRound = null, formationState = null, weaponBindState = null, maxBadges = 4 } = {}) => {
  if (!actor) return [];
  const badges = [];
  const seen = new Set();
  for (const status of Array.isArray(actor.statusEffects) ? actor.statusEffects : []) {
    if (!isWeaponConditionActive(status, currentRound)) continue;
    const type = normalizeText(typeof status === "string" ? status : status?.type || status?.id);
    const badge = CONDITION_BADGES[type];
    if (!badge || seen.has(badge.key)) continue;
    seen.add(badge.key);
    badges.push({ ...badge, expiresRound: typeof status === "object" ? status.expiresRound ?? null : null });
  }

  const activeBind = weaponBindState?.active === true ? weaponBindState : actor?.weaponBindState;
  if (activeBind?.active === true && !seen.has("weapon-bound")) {
    const base = CONDITION_BADGES[WEAPON_CONDITION_TYPES.WEAPON_BOUND];
    badges.push({
      ...base,
      title: activeBind.role === "controller" ? "Controlling a persistent weapon bind" : "Weapon held in a persistent bind",
    });
    seen.add("weapon-bound");
  }

  if (actor?.formationState?.anchored === true && !seen.has("formation-anchored")) {
    badges.push({ key: "formation-anchored", label: "AN", title: "Anchored position: improved control, voluntary movement breaks the stance", fill: "#166534" });
    seen.add("formation-anchored");
  }

  const shield = getShieldIntegrity(actor);
  if (shield?.state === SHIELD_INTEGRITY_STATES.BATTERED) {
    badges.push({ key: "shield-battered", label: "SH", title: `Battered shield ${shield.currentDurability}/${shield.maxDurability}`, fill: "#92400e" });
  }

  if (formationState?.state === "ordered-line" && !seen.has("formation-disrupted")) {
    badges.push({ key: "ordered-line", label: "FL", title: `Ordered formation line (+${formationState.supportBonus || 0} support)`, fill: "#15803d" });
  } else if (formationState?.state === "supported" && !seen.has("formation-disrupted")) {
    badges.push({ key: "formation-supported", label: "FS", title: "Spatially supported by an adjacent long weapon", fill: "#0f766e" });
  }

  return badges.slice(0, Math.max(1, Number(maxBadges) || 4));
};
