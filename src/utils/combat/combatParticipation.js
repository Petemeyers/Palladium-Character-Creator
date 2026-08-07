import { normalizeAlignmentBehavior } from "../behavior/normalizeAlignmentBehavior.js";
import { isCombatantBroken } from "../combatBrokenState.js";
import { isCombatantFled } from "../combatFledState.js";

const normalize = (value) => String(value ?? "").trim().toLowerCase().replaceAll("_", "-");
const idOf = (actor) => actor?.id ?? actor?._id ?? null;

const statusTokens = (actor = {}) => [
  actor.status,
  actor.condition,
  actor.combatStatus,
  actor.state?.status,
  actor.state?.moraleState,
  actor.moraleState?.status,
  actor.surrenderState?.status,
  actor.prisonerState?.status,
  ...(Array.isArray(actor.statusEffects) ? actor.statusEffects : []),
].map((value) => normalize(typeof value === "object" ? value?.type || value?.status : value));

const hasStatus = (actor, values) => {
  const expected = new Set(values.map(normalize));
  return statusTokens(actor).some((token) => expected.has(token));
};

export function isIncapacitated(actor = {}) {
  if (!actor) return true;
  const hp = Number(actor.currentHP ?? actor.hp ?? actor.HP ?? actor.hitPoints);
  return actor.dead === true || actor.isDead === true ||
    actor.unconscious === true || actor.isUnconscious === true || actor.isKO === true ||
    (Number.isFinite(hp) && hp <= 0) ||
    hasStatus(actor, ["dead", "dying", "unconscious", "unconsciousbleeding", "unconsciousstable"]);
}

export function isRoutedOrWithdrawn(actor = {}) {
  if (!actor) return true;
  return isCombatantFled(actor) || isCombatantBroken(actor) ||
    actor.hasFled === true || actor.removedFromCombat === true || actor.withdrawn === true ||
    hasStatus(actor, ["routed", "broken", "combat-broken", "fled", "escaped", "withdrawn", "removed"]);
}

export function isSurrenderedOrCaptured(actor = {}) {
  return actor?.isSurrendered === true || actor?.surrendered === true ||
    actor?.isCaptured === true || actor?.captured === true ||
    hasStatus(actor, ["surrendered", "accepted", "captured", "prisoner"]);
}

export function isCombatCapable(actor = {}) {
  if (!actor || idOf(actor) == null) return false;
  if (isRoutedOrWithdrawn(actor) || isSurrenderedOrCaptured(actor) || isIncapacitated(actor)) return false;
  if (actor.removedFromCombat === true || actor.inCombat === false) return false;
  // A conscious exhaustion collapse changes capability, not participation.
  if (actor.fatigueState?.status === "collapsed" || actor.collapsed === true) return true;
  return actor.canAct !== false;
}

export function isVictoryNeutralized(actor = {}) {
  return !isCombatCapable(actor);
}

export function isOrdinaryAttackTarget(actor = {}, { mayFinishIncapacitated = false } = {}) {
  if (!actor || idOf(actor) == null) return false;
  if (isRoutedOrWithdrawn(actor) || isSurrenderedOrCaptured(actor)) return false;
  if (actor.removedFromCombat === true || actor.inCombat === false) return false;
  if (isIncapacitated(actor)) return Boolean(mayFinishIncapacitated) && !hasStatus(actor, ["dead"]);
  return true;
}

export function canExplicitlyPursueRoutedTarget(attacker = {}, target = {}, context = {}) {
  if (!isRoutedOrWithdrawn(target) || isIncapacitated(target) || isSurrenderedOrCaptured(target)) return false;
  const explicit = context.explicitPursuit === true || context.activePursuit === true ||
    ["pursue", "pursue-routed", "no-escape", "kill-fleeing"].includes(normalize(context.order || context.orders));
  if (!explicit) return false;

  const behavior = normalizeAlignmentBehavior(
    context.alignmentBehavior || attacker.alignmentBehavior || attacker.alignment,
  );
  const mercy = Number(behavior?.dimensions?.mercy ?? 50);
  const cruelty = Number(behavior?.dimensions?.cruelty ?? 25);
  const tacticalDanger = context.targetRemainsDangerous === true || context.tacticalDanger === true ||
    context.protectingOthers === true;
  const bindingOrder = ["pursue", "pursue-routed", "no-escape", "kill-fleeing"]
    .includes(normalize(context.order || context.orders));
  const relentless = [attacker.aiRole, attacker.aggression, ...(attacker.tags || [])]
    .map(normalize).some((value) => ["pursuer", "relentless", "brutal", "berserk"].includes(value));

  if (tacticalDanger) return true;
  if (mercy >= 70 && cruelty < 40 && !bindingOrder) return false;
  return bindingOrder || relentless || cruelty > mercy;
}

export function auditCombatParticipation(actors = []) {
  const roster = Array.isArray(actors) ? actors : [];
  return {
    actorCount: roster.length,
    combatCapableCount: roster.filter(isCombatCapable).length,
    neutralizedCount: roster.filter(isVictoryNeutralized).length,
    ordinaryTargetCount: roster.filter((actor) => isOrdinaryAttackTarget(actor)).length,
  };
}

export default {
  auditCombatParticipation,
  canExplicitlyPursueRoutedTarget,
  isCombatCapable,
  isIncapacitated,
  isOrdinaryAttackTarget,
  isRoutedOrWithdrawn,
  isSurrenderedOrCaptured,
  isVictoryNeutralized,
};
