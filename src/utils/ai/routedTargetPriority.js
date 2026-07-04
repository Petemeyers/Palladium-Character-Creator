import { isCombatantFled } from "../combatFledState.js";
import { isCombatantBroken } from "../combatBrokenState.js";

const normalized = (value) => String(value || "").trim().toLowerCase();

export function isRoutingOrPassiveTarget(target = {}) {
  const morale = normalized(target.state?.moraleState || target.moraleState?.status);
  const effects = Array.isArray(target.statusEffects) ? target.statusEffects.map(normalized) : [];
  return ["routed", "broken", "cowering", "cower", "shaken"].includes(morale) ||
    effects.some((effect) => ["routed", "cowering", "cower"].includes(effect));
}

export function prioritizeEnemyCombatTargets({
  attacker = {}, candidates = [], positions = {}, calculateDistance, adjacentDistance = 5,
} = {}) {
  const viable = (Array.isArray(candidates) ? candidates : []).filter((target) => {
    if (!target || isCombatantFled(target) || isCombatantBroken(target)) return false;
    const status = normalized(target.status || target.moraleState?.status);
    const condition = normalized(target.condition);
    return !["dead", "unconscious", "dying", "surrendered", "fled"].includes(status) &&
      !["dead", "unconscious", "dying"].some((value) => condition.includes(value));
  });
  const active = viable.filter((target) => !isRoutingOrPassiveTarget(target));
  if (active.length === 0) return viable;
  const relentless = [attacker.aiRole, attacker.aggression, ...(attacker.tags || [])]
    .map(normalized).some((value) => ["pursuer", "brutal", "terror", "berserk"].includes(value));
  if (relentless) return viable;
  const attackerPos = positions?.[attacker.id];
  const routedBlockers = viable.filter((target) => {
    if (!isRoutingOrPassiveTarget(target)) return false;
    const targetPos = positions?.[target.id];
    return attackerPos && targetPos && typeof calculateDistance === "function" &&
      calculateDistance(attackerPos, targetPos) <= adjacentDistance;
  });
  return [...routedBlockers, ...active];
}

export default prioritizeEnemyCombatTargets;
