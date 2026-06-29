import { getFactionId, getTeamId, isHostileTo } from "./factionDisposition.js";
import { isCombatantFled } from "./combatFledState.js";

const normalize = (value) => String(value || "").trim().toLowerCase();
const getId = (combatant) => combatant?.id ?? combatant?._id ?? "";

export function isActiveCombatantForHostility(combatant = {}) {
  if (!combatant) return false;
  if (isCombatantFled(combatant)) return false;
  const hp = Number(combatant.currentHP ?? combatant.HP ?? combatant.hp ?? combatant.hitPoints);
  if (Number.isFinite(hp) && hp <= 0) return false;
  const status = normalize(combatant.status);
  const condition = normalize(combatant.condition);
  if (["defeated", "dead", "unconscious", "dying", "fled"].includes(status)) return false;
  if (["dead", "unconscious", "unconsciousbleeding", "unconsciousstable", "dying"].includes(condition)) return false;
  if (combatant.canAct === false) return false;
  return true;
}

export function areCombatantsOnSameSide(first = {}, second = {}) {
  const firstTeam = normalize(getTeamId(first));
  const secondTeam = normalize(getTeamId(second));
  if (firstTeam && secondTeam && firstTeam !== "neutral" && firstTeam === secondTeam) return true;

  const firstFaction = normalize(getFactionId(first));
  const secondFaction = normalize(getFactionId(second));
  return Boolean(firstFaction && secondFaction && firstFaction !== "neutral" && firstFaction === secondFaction);
}

export function getCombatHostilityState(combatants = [], sceneContext = { sceneType: "combat", relations: {} }) {
  const activeCombatants = Array.isArray(combatants)
    ? combatants.filter(isActiveCombatantForHostility)
    : [];
  const hostilePairs = [];

  activeCombatants.forEach((actor, index) => {
    activeCombatants.slice(index + 1).forEach((target) => {
      if (!getId(actor) || !getId(target) || getId(actor) === getId(target)) return;
      if (areCombatantsOnSameSide(actor, target)) return;
      if (isHostileTo(actor, target, sceneContext) || isHostileTo(target, actor, sceneContext)) {
        hostilePairs.push([getId(actor), getId(target)]);
      }
    });
  });

  return {
    activeCombatants,
    hostilePairs,
    hasHostileSides: hostilePairs.length > 0,
    noHostileSidesRemaining: activeCombatants.length > 0 && hostilePairs.length === 0,
  };
}

export default {
  areCombatantsOnSameSide,
  getCombatHostilityState,
  isActiveCombatantForHostility,
};
