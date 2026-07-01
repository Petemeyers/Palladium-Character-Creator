import { markActorFled } from "./morale/moraleChecks.js";

const normalize = (value) => String(value || "").trim().toLowerCase();

export function isCombatantFled(combatant = {}) {
  if (!combatant) return false;
  if (combatant.inBattle === false) return true;
  if (combatant.state?.hasFledBattle === true) return true;
  if (normalize(combatant.state?.moraleState) === "fled") return true;
  if (combatant.fled === true || combatant.moraleState?.hasFled === true) return true;
  if (normalize(combatant.status) === "fled") return true;
  if (normalize(combatant.moraleState?.status) === "fled") return true;
  return Array.isArray(combatant.statusEffects) && combatant.statusEffects.some(
    (effect) => normalize(effect) === "fled"
  );
}

export function markCombatantFled(combatant = {}) {
  const status = normalize(combatant.status);
  const condition = normalize(combatant.condition);
  const alreadyDead = (
    combatant.isDead === true ||
    status === "dead" ||
    condition === "dead"
  );
  const statusEffects = Array.isArray(combatant.statusEffects)
    ? combatant.statusEffects.filter((effect) => normalize(effect) !== "routed")
    : [];

  const marked = markActorFled({
    ...combatant,
    status: alreadyDead ? combatant.status : "fled",
    fled: true,
    canAct: false,
    remainingActions: 0,
    ...(Object.prototype.hasOwnProperty.call(combatant, "active") ? { active: false } : {}),
    ...(Object.prototype.hasOwnProperty.call(combatant, "isActive") ? { isActive: false } : {}),
    moraleState: {
      ...(combatant.moraleState || {}),
      status: alreadyDead ? combatant.moraleState?.status : "FLED",
      hasFled: true,
    },
    statusEffects: Array.from(new Set([...statusEffects, "FLED"])),
  });
  if (!alreadyDead) return marked;
  return {
    ...marked,
    status: combatant.status,
    moraleState: {
      ...marked.moraleState,
      status: combatant.moraleState?.status,
    },
  };
}

export function preserveCombatantFledState(previous = {}, next = {}) {
  return isCombatantFled(previous) || isCombatantFled(next)
    ? markCombatantFled({ ...previous, ...next, fled: true })
    : next;
}

export function removeFledCombatantPositions(combatants = [], positions = {}) {
  const nextPositions = { ...(positions || {}) };
  (Array.isArray(combatants) ? combatants : []).forEach((combatant) => {
    if (isCombatantFled(combatant) && combatant?.id != null) {
      delete nextPositions[combatant.id];
    }
  });
  return nextPositions;
}

export default markCombatantFled;
