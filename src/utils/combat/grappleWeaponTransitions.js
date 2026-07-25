import { createClinchWeaponProfile, isDaggerLikeWeapon } from "./clinchWeaponProfiles.js";
import { hasSufficientGroundControl } from "./exhaustionCollapseState.js";
import { isCanonicalNaturalAttack } from "./canonicalNaturalAttacks.js";

const asArray = (value) => Array.isArray(value) ? value.filter(Boolean) : [];

export function getCombatWeaponId(weapon = null) {
  return weapon?.weaponId || weapon?.id || weapon?._id || weapon?.name || null;
}

export function isMetadataTwoHandedWeapon(weapon = null) {
  if (!weapon) return false;
  const handed = String(weapon.handed || "").trim().toLowerCase();
  const category = String(weapon.category || "").trim().toLowerCase();
  return weapon.requiresTwoHands === true ||
    weapon.twoHanded === true ||
    Number(weapon.handsRequired) === 2 ||
    handed === "two-handed" ||
    handed === "two handed" ||
    handed === "2" ||
    category === "two-handed";
}

export function getFighterCombatWeapons(fighter = {}) {
  const candidates = [
    ...asArray(fighter.equistaminadWeapons),
    fighter.equistaminadWeapons?.primary,
    fighter.equistaminadWeapons?.secondary,
    fighter.weaponSlots?.rightHand,
    fighter.weaponSlots?.leftHand,
    fighter.weaponSlots?.twoHanded,
    fighter.weapon,
    fighter.equistaminadWeapon,
    ...asArray(fighter.attacks),
    ...asArray(fighter.inventory?.weapons),
    ...asArray(fighter.inventory),
  ].filter(Boolean);
  const seen = new Set();
  return candidates.filter((weapon) => {
    const id = getCombatWeaponId(weapon);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function findCombatWeapon(fighter = {}, weaponId = null) {
  if (!weaponId) return null;
  return getFighterCombatWeapons(fighter).find((weapon) => getCombatWeaponId(weapon) === weaponId) || null;
}

export function normalizeCombatWeaponState(fighter = {}) {
  const weapons = getFighterCombatWeapons(fighter);
  const existing = fighter.combatWeaponState || {};
  const defaultReady = weapons.find((weapon) => !weapon.disabled && !weapon.isFallbackUnarmed) || null;
  const hasReadyWeaponState = Object.prototype.hasOwnProperty.call(existing, "readyWeaponId");
  return {
    // An explicit null means the weapon was dropped or retained for this combat.
    // Do not repopulate it from permanent inventory on the next normalization.
    readyWeaponId: hasReadyWeaponState ? existing.readyWeaponId : getCombatWeaponId(defaultReady),
    retainedWeaponId: existing.retainedWeaponId ?? null,
    retainedWeaponDisposition: existing.retainedWeaponDisposition ?? null,
    clinchWeaponId: existing.clinchWeaponId ?? null,
    clinchWeaponReady: existing.clinchWeaponReady === true,
    droppedWeaponIds: asArray(existing.droppedWeaponIds),
    lastTransitionReason: existing.lastTransitionReason ?? null,
    lastTransitionRound: existing.lastTransitionRound ?? null,
    lastTransitionTurn: existing.lastTransitionTurn ?? null,
  };
}

export function createDroppedBattlefieldWeapon({
  fighter,
  weapon,
  position,
  round = null,
  turn = null,
  actionToken = null,
  dropReason = "grapple-commitment",
} = {}) {
  const itemId = getCombatWeaponId(weapon);
  if (!fighter?.id || !itemId || !position) return null;
  return Object.freeze({
    droppedItemId: ["dropped-weapon", fighter.id, itemId, actionToken || `${round ?? "round"}-${turn ?? "turn"}`].join(":"),
    itemId,
    itemSnapshot: { ...weapon },
    originalOwnerId: fighter.id,
    currentHex: { x: Number(position.x ?? 0), y: Number(position.y ?? 0) },
    droppedAtRound: round,
    droppedAtTurn: turn,
    dropReason,
    recoverable: true,
  });
}

export function resolveGrappleWeaponDisposition({
  fighter,
  readyWeapon = null,
  position,
  initiativeTurnId = null,
  actionToken = null,
  round = null,
  turn = null,
} = {}) {
  const prior = normalizeCombatWeaponState(fighter);
  const weapon = readyWeapon || findCombatWeapon(fighter, prior.readyWeaponId);
  const weaponId = getCombatWeaponId(weapon);
  const transitionBase = {
    lastTransitionRound: round,
    lastTransitionTurn: turn ?? initiativeTurnId,
  };
  if (!weapon || !weaponId || weapon.isFallbackUnarmed === true || isCanonicalNaturalAttack(weapon)) {
    const combatWeaponState = {
      ...prior,
      readyWeaponId: null,
      retainedWeaponId: null,
      retainedWeaponDisposition: null,
      lastTransitionReason: isCanonicalNaturalAttack(weapon) ? "grapple-commitment-natural-attacks-retained" : "grapple-commitment-unarmed",
      ...transitionBase,
    };
    return { disposition: isCanonicalNaturalAttack(weapon) ? "natural-attacks-retained" : "unarmed", retainedWeaponId: null, droppedWeaponId: null, droppedItemRecord: null, clinchWeaponReady: false, combatWeaponState };
  }
  if (isMetadataTwoHandedWeapon(weapon)) {
    const droppedItemRecord = createDroppedBattlefieldWeapon({ fighter, weapon, position, round, turn, actionToken, dropReason: "grapple-commitment-two-handed" });
    const combatWeaponState = {
      ...prior,
      readyWeaponId: null,
      retainedWeaponId: null,
      retainedWeaponDisposition: null,
      droppedWeaponIds: Array.from(new Set([...prior.droppedWeaponIds, weaponId])),
      lastTransitionReason: "grapple-commitment-two-handed-weapon-dropped",
      ...transitionBase,
    };
    return { disposition: "dropped-two-handed", retainedWeaponId: null, droppedWeaponId: weaponId, droppedItemRecord, clinchWeaponReady: false, combatWeaponState };
  }
  const combatWeaponState = {
    ...prior,
    readyWeaponId: null,
    retainedWeaponId: weaponId,
    retainedWeaponDisposition: "retained-unusable-in-clinch",
    lastTransitionReason: "grapple-commitment-one-handed-retained",
    ...transitionBase,
  };
  return { disposition: "retained-unusable-in-clinch", retainedWeaponId: weaponId, droppedWeaponId: null, droppedItemRecord: null, clinchWeaponReady: false, combatWeaponState };
}

export function findEligibleClinchWeapon(fighter = {}) {
  const state = normalizeCombatWeaponState(fighter);
  const weapons = getFighterCombatWeapons(fighter);
  return weapons.find((weapon) => {
    const id = getCombatWeaponId(weapon);
    if (!id || state.droppedWeaponIds.includes(id)) return false;
    return weapon.usableInClinch === true || isDaggerLikeWeapon(weapon);
  }) || null;
}

export function drawClinchDaggerTransition({ fighter, opponent, position, round = null, turn = null, actionToken = null } = {}) {
  const active = fighter?.grappleState?.opponent === opponent?.id && String(fighter?.grappleState?.state || "neutral") !== "neutral";
  if (!active) return { ok: false, reason: "active-clinch-required" };
  if ((Number(fighter?.remainingActions ?? 0) || 0) <= 0) return { ok: false, reason: "no-actions-remaining" };
  const prior = normalizeCombatWeaponState(fighter);
  const dagger = findEligibleClinchWeapon(fighter);
  if (!dagger) return { ok: false, reason: "no-eligible-clinch-weapon" };
  const daggerId = getCombatWeaponId(dagger);
  if (prior.clinchWeaponReady && prior.clinchWeaponId === daggerId) return { ok: false, reason: "clinch-weapon-already-ready" };
  const occupiedPrimaryId = prior.retainedWeaponId || (prior.readyWeaponId && prior.readyWeaponId !== daggerId ? prior.readyWeaponId : null);
  const retained = findCombatWeapon(fighter, occupiedPrimaryId);
  const droppedItemRecord = retained
    ? createDroppedBattlefieldWeapon({ fighter, weapon: retained, position, round, turn, actionToken, dropReason: "draw-clinch-dagger" })
    : null;
  const droppedIds = retained ? Array.from(new Set([...prior.droppedWeaponIds, occupiedPrimaryId])) : prior.droppedWeaponIds;
  const combatWeaponState = {
    ...prior,
    readyWeaponId: daggerId,
    retainedWeaponId: null,
    retainedWeaponDisposition: null,
    clinchWeaponId: daggerId,
    clinchWeaponReady: true,
    droppedWeaponIds: droppedIds,
    lastTransitionReason: "clinch-dagger-drawn",
    lastTransitionRound: round,
    lastTransitionTurn: turn,
  };
  return {
    ok: true,
    dagger,
    daggerId,
    priorWeaponDisposition: prior.retainedWeaponDisposition || (retained ? "ready-primary" : null),
    primaryWeaponDropped: Boolean(retained),
    droppedItemRecord,
    fighter: { ...fighter, remainingActions: 0, combatWeaponState },
    combatWeaponState,
  };
}

export function restoreRetainedWeaponAfterGrapple(fighter = {}, { round = null, turn = null, reason = "grapple-ended" } = {}) {
  const prior = normalizeCombatWeaponState(fighter);
  if (!prior.retainedWeaponId) return { ...fighter, combatWeaponState: prior };
  if (prior.droppedWeaponIds.includes(prior.retainedWeaponId)) {
    return { ...fighter, combatWeaponState: prior };
  }
  const retainedWeapon = findCombatWeapon(fighter, prior.retainedWeaponId);
  if (!retainedWeapon || retainedWeapon.broken === true || retainedWeapon.disabled === true || retainedWeapon.confiscated === true || retainedWeapon.lost === true) {
    return { ...fighter, combatWeaponState: prior };
  }
  const retainedId = getCombatWeaponId(retainedWeapon);
  const existingEquipped = Array.isArray(fighter.equistaminadWeapons)
    ? fighter.equistaminadWeapons
    : [fighter.equistaminadWeapons?.primary, fighter.equistaminadWeapons?.secondary].filter(Boolean);
  const equistaminadWeapons = [
    retainedWeapon,
    ...existingEquipped.filter((weapon) => getCombatWeaponId(weapon) !== retainedId),
  ];
  const ordinaryAttacks = [
    retainedWeapon,
    ...asArray(fighter.attacks).filter((attack) => {
      const attackId = getCombatWeaponId(attack);
      return attackId !== retainedId && attack?.isFallbackUnarmed !== true &&
        String(attack?.name || "").toLowerCase() !== "unarmed attack";
    }),
  ];
  return {
    ...fighter,
    equistaminadWeapons,
    equistaminadWeapon: retainedWeapon,
    selectedWeapon: retainedWeapon,
    weapon: retainedWeapon,
    attacks: ordinaryAttacks,
    combatWeaponState: {
      ...prior,
      readyWeaponId: retainedId,
      retainedWeaponId: null,
      retainedWeaponDisposition: null,
      clinchWeaponId: null,
      clinchWeaponReady: false,
      lastTransitionReason: reason,
      lastTransitionRound: round,
      lastTransitionTurn: turn,
    },
  };
}

export function recoverDroppedWeaponTransition({ fighter, droppedItem, round = null, turn = null } = {}) {
  if (!fighter || !droppedItem?.recoverable) return { ok: false, reason: "dropped-weapon-not-recoverable" };
  if (String(fighter?.grappleState?.state || "neutral") !== "neutral") return { ok: false, reason: "cannot-recover-during-grapple" };
  if ((Number(fighter.remainingActions ?? 0) || 0) <= 0) return { ok: false, reason: "no-actions-remaining" };
  const position = fighter.hex || fighter.position;
  if (!position || Number(position.x) !== Number(droppedItem.currentHex?.x) || Number(position.y) !== Number(droppedItem.currentHex?.y)) {
    return { ok: false, reason: "dropped-weapon-not-on-current-hex" };
  }
  const prior = normalizeCombatWeaponState(fighter);
  const combatWeaponState = {
    ...prior,
    readyWeaponId: droppedItem.itemId,
    droppedWeaponIds: prior.droppedWeaponIds.filter((id) => id !== droppedItem.itemId),
    lastTransitionReason: "dropped-weapon-recovered",
    lastTransitionRound: round,
    lastTransitionTurn: turn,
  };
  return { ok: true, droppedItemId: droppedItem.droppedItemId, weaponId: droppedItem.itemId, fighter: { ...fighter, remainingActions: 0, combatWeaponState }, combatWeaponState };
}

export function isStandingClinch(fighter = {}, opponent = {}) {
  const groundedPosition = [fighter?.grappleState?.positionState, opponent?.grappleState?.positionState]
    .some((state) => ["ground", "grounded"].includes(String(state || "").toLowerCase()));
  return fighter?.grappleState?.opponent === opponent?.id && opponent?.grappleState?.opponent === fighter?.id &&
    !groundedPosition && String(fighter?.grappleState?.state) === "grapple_clinch" && String(opponent?.grappleState?.state) === "grapple_clinch";
}

export function isGroundedGrapple(fighter = {}, opponent = {}) {
  const states = [String(fighter?.grappleState?.state || ""), String(opponent?.grappleState?.state || "")];
  const positions = [fighter?.grappleState?.positionState, opponent?.grappleState?.positionState]
    .map((state) => String(state || "").toLowerCase());
  return fighter?.grappleState?.opponent === opponent?.id &&
    (states.some((state) => state === "grapple_ground" || state === "grappled") ||
      positions.some((state) => state === "ground" || state === "grounded"));
}

export function getPhase3B2GrappleActions(fighter = {}, opponent = {}) {
  if ((Number(fighter?.remainingActions ?? 0) || 0) <= 0) return [];
  if (isStandingClinch(fighter, opponent)) {
    const state = normalizeCombatWeaponState(fighter);
    const dagger = findEligibleClinchWeapon(fighter);
    const actions = ["breakFree", "reverseControl", "improveControl"];
    if (dagger && !state.clinchWeaponReady) actions.push("drawClinchDagger");
    if (state.clinchWeaponReady || !dagger) actions.push("clinchStrike");
    actions.push("takedown", "releaseGrapple");
    return actions;
  }
  if (isGroundedGrapple(fighter, opponent)) {
    const state = normalizeCombatWeaponState(fighter);
    const actions = ["breakFree", "reverseControl", "improveControl", "secureGroundControl", "holdAndRest"];
    if (hasSufficientGroundControl(fighter, opponent) && state.clinchWeaponReady) actions.push("groundedArmorGapStrike");
    if (hasSufficientGroundControl(fighter, opponent)) actions.push("demandSurrender");
    actions.push("groundAttack", "releaseGrapple");
    return actions;
  }
  return [];
}

export function getReadyClinchWeaponProfile(fighter = {}) {
  const state = normalizeCombatWeaponState(fighter);
  if (!state.clinchWeaponReady || !state.clinchWeaponId) return createClinchWeaponProfile(null, fighter);
  const weapon = findCombatWeapon(fighter, state.clinchWeaponId);
  return weapon ? createClinchWeaponProfile(weapon, fighter) : null;
}

export function applyInitialGrappleTurnEndingCommitment(fighter = {}, outcome = {}) {
  return {
    ...fighter,
    ...(outcome && typeof outcome === "object" ? outcome : {}),
    remainingActions: 0,
    attacksRemaining: 0,
  };
}

export default {
  drawClinchDaggerTransition,
  applyInitialGrappleTurnEndingCommitment,
  findEligibleClinchWeapon,
  getPhase3B2GrappleActions,
  getReadyClinchWeaponProfile,
  isGroundedGrapple,
  isMetadataTwoHandedWeapon,
  isStandingClinch,
  normalizeCombatWeaponState,
  recoverDroppedWeaponTransition,
  resolveGrappleWeaponDisposition,
  restoreRetainedWeaponAfterGrapple,
};
