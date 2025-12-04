// src/utils/horrorSystem.js
import CryptoSecureDice from "./cryptoDice";

/**
 * Returns true if this creature should trigger Horror Factor.
 * Knights / soldiers / normal humanoids should have HF 0 or undefined.
 */
export function hasHorrorFactor(creature) {
  if (!creature) return false;

  const HF = creature.HF || creature.hf || creature.horrorFactor || 0;

  return HF > 0;
}

/**
 * Get numeric Horror Factor (0 if none).
 */
export function getHorrorFactor(creature) {
  if (!creature) return 0;

  return creature.HF || creature.hf || creature.horrorFactor || 0;
}

/**
 * Ensure mentalState structure exists.
 */
export function ensureMentalState(fighter) {
  const base = fighter.mentalState || {};
  return {
    horrorSeen: base.horrorSeen instanceof Set ? base.horrorSeen : new Set(base.horrorSeen || []),
    insanityPoints: base.insanityPoints || 0,
    disorders: base.disorders || [],
    lastFailedHorrorId: base.lastFailedHorrorId || null,
  };
}

/**
 * Resolve a horror check when a viewer first clearly sees a horrorSource.
 * Returns { triggered, success, result, updatedViewer }.
 *
 * NOTE: This does not apply any conditions in the world – just updates mentalState.
 * Caller decides what penalties or behavior to apply on failure.
 */
export function resolveHorrorCheck(viewer, horrorSource) {
  if (!viewer || !horrorSource) {
    return { triggered: false, success: true, result: null, updatedViewer: viewer };
  }

  const HF = getHorrorFactor(horrorSource);
  if (HF <= 0) {
    // Non-horror: do nothing.
    return { triggered: false, success: true, result: null, updatedViewer: viewer };
  }

  const mentalState = ensureMentalState(viewer);
  const horrorId = horrorSource.id || horrorSource.name;
  if (!horrorId) {
    return { triggered: false, success: true, result: null, updatedViewer: viewer };
  }

  // Only one check per horror per scene
  if (mentalState.horrorSeen.has(horrorId)) {
    return { triggered: false, success: true, result: null, updatedViewer: { ...viewer, mentalState } };
  }
  mentalState.horrorSeen.add(horrorId);

  // ME-based check: d20 + ME vs 10 + HF (classic Palladium-ish)
  const ME =
    viewer.attributes?.ME ||
    viewer.ME ||
    viewer.stats?.ME ||
    10;

  const rollResult = CryptoSecureDice.rollD20();
  const roll = rollResult.totalWithBonus;
  const dc = 10 + HF;
  const total = roll + ME;
  const success = total >= dc;

  if (!success) {
    // Failure increases insanity build-up slightly
    mentalState.insanityPoints += 1;
    mentalState.lastFailedHorrorId = horrorId;
  }

  const updatedViewer = {
    ...viewer,
    mentalState,
  };

  return {
    triggered: true,
    success,
    result: {
      roll,
      ME,
      dc,
      total,
      HF,
      horrorId,
    },
    updatedViewer,
  };
}

