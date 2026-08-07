import { isCombatantFled } from "../combatFledState.js";
import { isCombatantBroken } from "../combatBrokenState.js";
import {
  canExplicitlyPursueRoutedTarget,
  isIncapacitated,
  isOrdinaryAttackTarget,
  isRoutedOrWithdrawn,
  isSurrenderedOrCaptured,
} from "../combat/combatParticipation.js";

const normalized = (value) => String(value || "").trim().toLowerCase();

export function isRoutingOrPassiveTarget(target = {}) {
  const morale = normalized(target.state?.moraleState || target.moraleState?.status);
  const effects = Array.isArray(target.statusEffects) ? target.statusEffects.map(normalized) : [];
  return ["routed", "broken", "cowering", "cower"].includes(morale) ||
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
  if (hasToken("surrendered") || target.surrendered === true || target.isSurrendered === true) return "surrendered";
  if (hasToken("captured") || target.captured === true || target.isCaptured === true) return "captured";
  if (isCombatantBroken(target) || hasToken("combat-broken") || hasToken("broken")) return "combat-broken";
  if (isRoutedOrWithdrawn(target)) return "routed-or-withdrawn";
  if (isSurrenderedOrCaptured(target)) return "surrendered-or-captured";
  if (isIncapacitated(target) && !options.mayFinishIncapacitated) {
    return hasToken("unconscious") || target.unconscious === true ? "unconscious" : "incapacitated";
  }
  if (!isOrdinaryAttackTarget(target, options)) return "not-an-ordinary-attack-target";
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
  attacker = {}, candidates = [],
  pursuitContext = null,
} = {}) {
  const viable = (Array.isArray(candidates) ? candidates : []).filter((target) => {
    const attackerId = attacker.id ?? attacker._id;
    const targetId = target?.id ?? target?._id;
    return !(attackerId != null && targetId != null && String(attackerId) === String(targetId)) &&
      !getCombatTargetExclusionReason(target);
  });
  const active = viable.filter((target) => !isRoutingOrPassiveTarget(target));
  if (!pursuitContext) return active;
  const pursued = (Array.isArray(candidates) ? candidates : []).filter((target) =>
    canExplicitlyPursueRoutedTarget(attacker, target, pursuitContext),
  );
  return [...active, ...pursued];
}

export default prioritizeEnemyCombatTargets;
