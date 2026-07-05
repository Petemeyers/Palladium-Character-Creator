import { isCombatantFled } from "../combatFledState.js";
import { isCombatantBroken } from "../combatBrokenState.js";

const normalized = (value) => String(value || "").trim().toLowerCase();

export function isRoutingOrPassiveTarget(target = {}) {
  const morale = normalized(target.state?.moraleState || target.moraleState?.status);
  const effects = Array.isArray(target.statusEffects) ? target.statusEffects.map(normalized) : [];
  return ["routed", "broken", "cowering", "cower", "shaken"].includes(morale) ||
    effects.some((effect) => ["routed", "cowering", "cower"].includes(effect));
}

const statusTokens = (target = {}) => [
  target.status,
  target.condition,
  target.state?.status,
  target.moraleState?.status,
  target.state?.moraleState,
  ...(Array.isArray(target.statusEffects) ? target.statusEffects : []),
].map((value) => normalized(typeof value === "object" ? value?.type || value?.status : value));

export function getCombatTargetExclusionReason(target = {}, options = {}) {
  if (!target) return "missing combatant";
  const tokens = statusTokens(target);
  const hasToken = (value) => tokens.some((token) => token === value || token.includes(value));
  if (isCombatantFled(target) || hasToken("fled")) return "fled";
  if (hasToken("surrendered")) return "surrendered";
  if (isCombatantBroken(target) || hasToken("combat-broken") || hasToken("broken")) return "combat-broken";
  if (hasToken("dead") || target.isDead === true || Number(target.currentHP) <= -20) return "dead";
  if (hasToken("dying")) return "dying";
  if (hasToken("unconscious") || target.isKO === true) return "unconscious";
  if (Number.isFinite(Number(target.currentHP)) && Number(target.currentHP) <= 0) return "unconscious";
  if (typeof options.isHostile === "function" && !options.isHostile(target)) return "allied or not hostile";
  if (typeof options.canSelect === "function" && !options.canSelect(target)) return "not selectable in current scene";
  if (typeof options.canAct === "function" && !options.canAct(target)) return "inactive or unable to act";
  if (typeof options.additionalReason === "function") return options.additionalReason(target) || null;
  return null;
}

export function partitionCombatTargets(candidates = [], options = {}) {
  return (Array.isArray(candidates) ? candidates : []).reduce((result, target) => {
    const reason = getCombatTargetExclusionReason(target, options);
    if (reason) result.excluded.push({ target, reason });
    else result.eligible.push(target);
    return result;
  }, { eligible: [], excluded: [] });
}

export function prioritizeEnemyCombatTargets({
  attacker = {}, candidates = [], positions = {}, calculateDistance, adjacentDistance = 5,
} = {}) {
  const viable = (Array.isArray(candidates) ? candidates : []).filter((target) => {
    return !getCombatTargetExclusionReason(target);
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
