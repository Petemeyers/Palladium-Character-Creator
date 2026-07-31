import {
  findEligibleClinchWeapon,
  isGroundedGrapple,
  isStandingClinch,
  normalizeCombatWeaponState,
} from "../combat/grappleWeaponTransitions.js";
import { hasSufficientGroundControl } from "../combat/exhaustionCollapseState.js";
import { hasReciprocalGrapplePair } from "../combat/grapplePairing.js";

function text(value) {
  return String(value || "").toLowerCase();
}

export function getActiveGrappleOpponent(actor = {}, fighters = []) {
  const opponentId = actor?.grappleState?.opponent || actor?.grappleState?.opponentId;
  if (!opponentId) return null;
  return (Array.isArray(fighters) ? fighters : []).find((fighter) => fighter?.id === opponentId) || null;
}

export function hasActiveGrappleState(actor = {}, opponent = null) {
  return hasReciprocalGrapplePair(actor, opponent);
}

export function resolveGrappleTurnAction({
  actor,
  opponent,
  grappleState = actor?.grappleState,
  remainingActions = actor?.remainingActions,
  availableClinchWeapons = [],
  generationId = "default",
  round = null,
  initiativeIndex = null,
  initiativeTurnId = null,
  turnToken = null,
  actionToken = null,
  source = "ai",
} = {}) {
  const active = hasActiveGrappleState({ ...actor, grappleState }, opponent);
  if (!active) {
    return { handled: false, reason: "no-active-grapple" };
  }

  const state = text(grappleState?.state);
  const weapons = Array.isArray(availableClinchWeapons) ? availableClinchWeapons : [];
  const routingActor = { ...actor, grappleState, attacks: [...(actor?.attacks || []), ...weapons] };
  const weaponState = normalizeCombatWeaponState(routingActor);
  const dagger = findEligibleClinchWeapon(routingActor);
  const unarmed =
    weapons.find((weapon) => /unarmed|fist|punch/.test(text(weapon?.name || weapon?.type))) ||
    { id: "Unarmed Attack", name: "Unarmed Attack", type: "unarmed" };
  const canAct = (Number(remainingActions ?? 0) || 0) > 0;
  const standing = isStandingClinch(routingActor, opponent);
  const grounded = isGroundedGrapple(routingActor, opponent);
  const defenderFirstEscape = standing && grappleState?.isAttacker !== true &&
    !weaponState.clinchWeaponReady && (Number(remainingActions ?? 0) || 0) > 1;
  const dominantGroundControl = grounded && hasSufficientGroundControl(routingActor, opponent);
  const actionType = !canAct
    ? "pass"
    : grounded
      ? dominantGroundControl && weaponState.clinchWeaponReady
        ? "groundedArmorGapStrike"
        : dominantGroundControl && opponent?.fatigueState?.status === "collapsed"
          ? "demandSurrender"
          : "groundAttack"
      : defenderFirstEscape
        ? "breakFree"
        : dagger && !weaponState.clinchWeaponReady
          ? "drawClinchDagger"
          : "clinchStrike";
  const actionName = actionType === "drawClinchDagger"
    ? "Draw Clinch Dagger"
    : actionType === "breakFree"
      ? "Break Free"
      : actionType === "groundAttack"
        ? "Ground Attack"
        : actionType === "groundedArmorGapStrike"
          ? "Grounded Armor-Gap Strike"
          : actionType === "secureGroundControl"
            ? "Secure Ground Control"
            : actionType === "demandSurrender"
              ? "Demand Surrender"
        : canAct ? "Clinch Strike" : "Pass";
  const weapon = weaponState.clinchWeaponReady ? dagger : (actionType === "clinchStrike" ? unarmed : dagger || unarmed || null);
  const executionKey = [
    "grapple-turn",
    generationId || "default",
    turnToken || "missing-token",
    actor?.id || "unknown-actor",
    opponent?.id || grappleState?.opponent || "unknown-opponent",
    actionType,
  ].join(":");

  const routedActionType = actionType;
  const routedActionName = actionName;
  return {
    handled: true,
    routeType: canAct ? "grapple-dispatch-required" : "legal-pass",
    grappleAction: canAct
      ? {
          actionType: routedActionType,
          actionName: routedActionName,
          grappleActionId: executionKey,
          actorId: actor?.id || null,
          opponentId: opponent?.id || grappleState?.opponent || null,
          generationId,
          round,
          initiativeIndex,
          initiativeTurnId,
          actionToken,
          weaponId: weapon?.id || weapon?.name || null,
          weaponName: weapon?.name || null,
        }
      : null,
    actionType: routedActionType,
    actionName: routedActionName,
    grappleActionId: executionKey,
    actorId: actor?.id || null,
    opponentId: opponent?.id || grappleState?.opponent || null,
    generationId,
    round,
    initiativeIndex,
    initiativeTurnId,
    actionToken,
    actionAccepted: true,
    actionSpent: !canAct,
    staminaSpent: 0,
    stateChanged: false,
    remainingActions: Number(remainingActions ?? 0) || 0,
    executionKey,
    completionSource: `${source}-active-grapple`,
    turnEndingEffect: false,
    dispatchRequired: canAct,
    weaponId: canAct ? (weapon?.id || weapon?.name || null) : null,
    weaponName: canAct ? (weapon?.name || null) : null,
    reason: canAct ? (standing ? "standing-active-clinch" : grounded ? "grounded-grapple" : `active-grapple-${state}`) : "no-actions",
  };
}

export default resolveGrappleTurnAction;
