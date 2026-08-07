import { getWeaponTacticalTraits } from "./weaponEngagementAuthority.js";

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();
const toFinite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const SHIELD_INTEGRITY_STATES = Object.freeze({
  PRISTINE: "pristine",
  WORN: "worn",
  BATTERED: "battered",
  BROKEN: "broken",
});

export const getActorShield = (actor = {}) => {
  const candidate = actor?.equippedShield || actor?.equipped?.shield || actor?.shield || actor?.armorProfile?.shield || actor?.equipmentSelection?.shield || null;
  if (!candidate || normalizeText(candidate?.name || candidate) === "none") return null;
  return typeof candidate === "string" ? { name: candidate, id: candidate, type: "shield" } : candidate;
};

export const getCanonicalShieldDurability = (shield = {}) => {
  const identity = normalizeText([shield?.name, shield?.displayName, shield?.id, shield?.type, shield?.material].filter(Boolean).join(" "));
  if (identity.includes("pavise")) return 24;
  if (identity.includes("kite")) return 20;
  if (identity.includes("heater")) return 18;
  if (identity.includes("metal") || identity.includes("steel")) return 18;
  if (identity.includes("round") || identity.includes("wood")) return 14;
  if (identity.includes("buckler")) return 10;
  return Math.max(8, toFinite(shield?.maxDurability ?? shield?.durability, 14));
};

export const getShieldIntegrity = (actor = {}) => {
  const shield = getActorShield(actor);
  if (!shield) return null;
  const maxDurability = Math.max(1, toFinite(
    actor?.shieldIntegrity?.maxDurability ?? shield?.maxDurability ?? shield?.durability,
    getCanonicalShieldDurability(shield),
  ));
  const currentDurability = Math.max(0, Math.min(maxDurability, toFinite(
    actor?.shieldIntegrity?.currentDurability ?? shield?.currentDurability ?? shield?.durability,
    maxDurability,
  )));
  const ratio = currentDurability / maxDurability;
  const state = currentDurability <= 0
    ? SHIELD_INTEGRITY_STATES.BROKEN
    : ratio <= 0.35
      ? SHIELD_INTEGRITY_STATES.BATTERED
      : ratio <= 0.75
        ? SHIELD_INTEGRITY_STATES.WORN
        : SHIELD_INTEGRITY_STATES.PRISTINE;
  return {
    shield,
    shieldId: shield?.id || shield?.profileKey || shield?.name || "shield",
    name: shield?.name || shield?.displayName || "Shield",
    maxDurability,
    currentDurability,
    ratio,
    state,
    defensePenalty: state === SHIELD_INTEGRITY_STATES.BATTERED ? -1 : state === SHIELD_INTEGRITY_STATES.BROKEN ? -99 : 0,
  };
};

export const resolveShieldImpact = ({
  defender,
  attackWeapon,
  attackNaturalRoll = null,
  attackTotal = null,
  defenseTotal = null,
  currentRound = null,
  source = "shield-block",
} = {}) => {
  const integrity = getShieldIntegrity(defender);
  if (!integrity || integrity.state === SHIELD_INTEGRITY_STATES.BROKEN) {
    return { applied: false, reason: "no-usable-shield", integrity };
  }
  const traits = getWeaponTacticalTraits(attackWeapon || {});
  const identity = normalizeText([attackWeapon?.name, attackWeapon?.id, attackWeapon?.type, attackWeapon?.primaryDelivery].filter(Boolean).join(" "));
  let damage = 1;
  if (traits.family === "axe" || /axe|chop|cleaver/.test(identity)) damage = 3;
  else if (traits.family === "impact" || /mace|hammer|maul|blunt/.test(identity)) damage = 2;
  else if (traits.isGreatsword || /greatsword|two-handed sword/.test(identity)) damage = 2;
  else if (traits.family === "dagger") damage = 0;
  if (Number(attackNaturalRoll) === 20) damage += 2;
  const margin = toFinite(attackTotal) - toFinite(defenseTotal);
  if (margin >= 5) damage += 1;
  damage = Math.max(0, Math.min(6, damage));
  const nextDurability = Math.max(0, integrity.currentDurability - damage);
  const ratio = nextDurability / integrity.maxDurability;
  const nextState = nextDurability <= 0
    ? SHIELD_INTEGRITY_STATES.BROKEN
    : ratio <= 0.35
      ? SHIELD_INTEGRITY_STATES.BATTERED
      : ratio <= 0.75
        ? SHIELD_INTEGRITY_STATES.WORN
        : SHIELD_INTEGRITY_STATES.PRISTINE;
  return {
    applied: damage > 0,
    source,
    currentRound,
    damage,
    previousDurability: integrity.currentDurability,
    nextDurability,
    maxDurability: integrity.maxDurability,
    previousState: integrity.state,
    nextState,
    broken: nextState === SHIELD_INTEGRITY_STATES.BROKEN,
    shieldId: integrity.shieldId,
    shieldName: integrity.name,
    attackWeaponFamily: traits.family,
    attackNaturalRoll: Number(attackNaturalRoll) || null,
    attackTotal: Number(attackTotal) || null,
    defenseTotal: Number(defenseTotal) || null,
  };
};

const updateShieldObject = (shield, result) => {
  if (!shield || typeof shield !== "object") return shield;
  return {
    ...shield,
    currentDurability: result.nextDurability,
    maxDurability: result.maxDurability,
    durability: result.nextDurability,
    integrityState: result.nextState,
    broken: result.broken,
  };
};

export const applyShieldImpactToActor = (actor, result) => {
  if (!actor || !result?.applied) return actor;
  const activeShield = getActorShield(actor);
  const nextIntegrity = {
    shieldId: result.shieldId,
    name: result.shieldName,
    currentDurability: result.nextDurability,
    maxDurability: result.maxDurability,
    state: result.nextState,
    broken: result.broken,
  };
  if (!result.broken) {
    return {
      ...actor,
      shieldIntegrity: nextIntegrity,
      equippedShield: updateShieldObject(actor.equippedShield || activeShield, result),
      equipped: actor.equipped ? { ...actor.equipped, shield: updateShieldObject(actor.equipped.shield || activeShield, result) } : actor.equipped,
      armorProfile: actor.armorProfile ? { ...actor.armorProfile, shield: updateShieldObject(actor.armorProfile.shield || activeShield, result) } : actor.armorProfile,
    };
  }

  const previousDefense = toFinite(actor.defenseRating ?? actor.guardRating ?? actor.armorClass ?? actor.ac, 10);
  const nextDefense = Math.max(0, previousDefense - 1);
  return {
    ...actor,
    shieldIntegrity: nextIntegrity,
    shieldBroken: true,
    equippedShield: null,
    shield: null,
    heldItems: actor.heldItems ? { ...actor.heldItems, shield: null } : actor.heldItems,
    equipped: actor.equipped ? { ...actor.equipped, shield: null } : actor.equipped,
    armorProfile: actor.armorProfile ? { ...actor.armorProfile, shield: null } : actor.armorProfile,
    equipmentSelection: actor.equipmentSelection ? { ...actor.equipmentSelection, shield: "None" } : actor.equipmentSelection,
    defenseRating: nextDefense,
    guardRating: nextDefense,
    armorClass: nextDefense,
    ac: nextDefense,
    derivedStats: actor.derivedStats ? { ...actor.derivedStats, defenseRating: nextDefense, armorClass: nextDefense } : actor.derivedStats,
  };
};

export const getShieldDefensePenalty = (actor) => getShieldIntegrity(actor)?.defensePenalty || 0;
