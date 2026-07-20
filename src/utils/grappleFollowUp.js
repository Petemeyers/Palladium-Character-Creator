import { selectMeleeAttackForContext } from "./meleeEngagementContext.js";
import { createClinchWeaponProfile } from "./combat/clinchWeaponProfiles.js";

const actionCount = (actor = {}) => {
  const value = Number(actor.remainingActions ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
};

export function getGrappleFollowUpActionBudget(actor = {}) {
  const remainingBefore = actionCount(actor);
  const canAct = remainingBefore > 0;
  const remainingAfter = canAct ? remainingBefore - 1 : 0;
  return {
    canAct,
    remainingBefore,
    remainingAfter,
    shouldPassTurn: remainingAfter <= 0,
  };
}

export function applyGrappleFollowUpOutcome(actor = {}, outcome = {}) {
  const budget = getGrappleFollowUpActionBudget(actor);
  if (!budget.canAct) {
    return { ok: false, actor: { ...actor }, ...budget };
  }
  return {
    ok: true,
    actor: {
      ...actor,
      ...(outcome && typeof outcome === "object" ? outcome : {}),
      remainingActions: budget.remainingAfter,
    },
    ...budget,
  };
}

export function selectGrappleFollowUpWeapon(actor = {}) {
  const selection = selectMeleeAttackForContext({
    actor,
    context: {
      isClinched: true,
      isGrappling: true,
      isGround: false,
      isAdjacent: true,
      rangeBand: "clinch",
    },
  });
  const attack = selection.attack || null;
  const usesGroundFallback = !attack || attack.isFallbackUnarmed === true;
  const weapon = createClinchWeaponProfile(usesGroundFallback ? null : attack, actor);
  return {
    ...selection,
    attack,
    weapon,
    usesGroundFallback,
  };
}

export default {
  applyGrappleFollowUpOutcome,
  getGrappleFollowUpActionBudget,
  selectGrappleFollowUpWeapon,
};
