import { calculateAttackStaminaCost, spendCombatStamina } from "../combatStamina.js";
import { resolveWeaponActionStaminaCost } from "./weaponEngagementAuthority.js";

export const CHARGE_CATALOG_MOVEMENT_STAMINA_COST = 1;
export const CHARGE_FOLLOW_THROUGH_SOURCE = "charge-follow-through";

export function readActiveStaminaAliases(fighter = {}) {
  const combatStamina = Number(
    fighter?.combatStamina?.currentStamina ?? fighter?.combatStamina?.current,
  );
  const currentStamina = Number(fighter?.currentStamina);
  const currentstamina = Number(fighter?.currentstamina);
  const stamina = Number(fighter?.stamina);
  const aliases = {
    combatStamina: Number.isFinite(combatStamina) ? combatStamina : null,
    currentStamina: Number.isFinite(currentStamina) ? currentStamina : null,
    currentstamina: Number.isFinite(currentstamina) ? currentstamina : null,
    stamina: Number.isFinite(stamina) ? stamina : null,
    fatigueLabel: fighter?.fatigueLabel ?? fighter?.fatigueState?.label ?? null,
  };
  const activeValues = [aliases.combatStamina, aliases.currentStamina, aliases.currentstamina, aliases.stamina]
    .filter((value) => value != null);
  aliases.agree = activeValues.length <= 1 || activeValues.every((value) => value === activeValues[0]);
  aliases.canonical = aliases.combatStamina ?? aliases.currentStamina ?? aliases.currentstamina ?? aliases.stamina;
  return aliases;
}

export function resolveChargeCombinedActionStaminaCosts({
  fighter = {},
  weapon = {},
} = {}) {
  const movementCost = CHARGE_CATALOG_MOVEMENT_STAMINA_COST;
  const fallbackCost = calculateAttackStaminaCost({ fighter, weapon, attackType: "melee" });
  const attack = resolveWeaponActionStaminaCost({
    fighter,
    weapon,
    actionType: "attack",
    source: CHARGE_FOLLOW_THROUGH_SOURCE,
    fallbackCost,
  });
  return {
    movementCost,
    followThroughAttackCost: Number(attack.cost) || 0,
    totalCost: movementCost + (Number(attack.cost) || 0),
    attackCommitment: attack.commitment,
    attackCostSource: attack.source,
  };
}

export function applyCanonicalCatalogMovementStaminaSpend({
  fighter,
  amount,
  spend = spendCombatStamina,
  reason = "movement",
  source = "movement-catalog",
  executionKey = null,
} = {}) {
  const requested = Math.max(0, Number(amount) || 0);
  const previous = readActiveStaminaAliases(fighter);
  if (requested <= 0) {
    return {
      accepted: true,
      skipped: true,
      spent: 0,
      previousStamina: previous.canonical,
      nextStamina: previous.canonical,
      updated: fighter,
      aliases: previous,
    };
  }
  const result = spend({
    fighter,
    amount: requested,
    reason,
    source,
    executionKey,
  });
  const accepted = result?.accepted === true || result?.ok === true;
  const updated = result?.updated || fighter;
  return {
    accepted,
    skipped: false,
    reason: result?.reason || (accepted ? reason : "movement-stamina-rejected"),
    spent: accepted ? (result?.spent ?? result?.appliedSpend ?? requested) : 0,
    previousStamina: result?.previousStamina ?? previous.canonical,
    nextStamina: result?.nextStamina ?? result?.currentStamina ?? previous.canonical,
    updated,
    aliases: readActiveStaminaAliases(updated),
    spendResult: result,
  };
}

export function applyChargeFollowThroughStaminaSpend({
  fighter,
  weapon,
  spend = spendCombatStamina,
  executionKey = null,
  originControlMode = "unspecified",
} = {}) {
  const costs = resolveChargeCombinedActionStaminaCosts({ fighter, weapon });
  const result = spend({
    fighter,
    amount: costs.followThroughAttackCost,
    reason: "attack",
    source: CHARGE_FOLLOW_THROUGH_SOURCE,
    executionKey,
  });
  const accepted = result?.accepted === true || result?.ok === true;
  const updated = result?.updated || fighter;
  return {
    accepted,
    originControlMode,
    costs,
    spent: accepted ? (result?.spent ?? result?.appliedSpend ?? costs.followThroughAttackCost) : 0,
    previousStamina: result?.previousStamina ?? readActiveStaminaAliases(fighter).canonical,
    nextStamina: result?.nextStamina ?? result?.currentStamina,
    updated,
    aliases: readActiveStaminaAliases(updated),
    spendResult: result,
  };
}

export default {
  CHARGE_CATALOG_MOVEMENT_STAMINA_COST,
  CHARGE_FOLLOW_THROUGH_SOURCE,
  applyCanonicalCatalogMovementStaminaSpend,
  applyChargeFollowThroughStaminaSpend,
  readActiveStaminaAliases,
  resolveChargeCombinedActionStaminaCosts,
};
