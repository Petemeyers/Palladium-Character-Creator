import { createTacticalActionIntent } from "../src/utils/combat/tacticalActionIntent.js";

export const sword = { id: "longsword", name: "Long Sword", type: "melee", canParry: true };
export const shield = { id: "heater-shield", name: "Heater Shield", isShield: true };

export function fighter(id, team, patch = {}) {
  return {
    id,
    name: id,
    team,
    currentHP: 20,
    currentStamina: 10,
    controlMode: "ai",
    attacks: [sword],
    weaponSlots: { rightHand: sword, leftHand: null },
    ...patch,
  };
}

export function reactionIntent(patch = {}) {
  return createTacticalActionIntent({
    actionIntentId: patch.actionIntentId || "reaction-attack",
    generationId: patch.generationId ?? 1,
    combatSession: patch.combatSession ?? 1,
    actorId: patch.actorId || "attacker",
    targetActorId: patch.targetActorId || "defender",
    weaponId: patch.weaponId || "longsword",
    actionType: patch.actionType || "melee-attack",
    timingKey: patch.timingKey || "daggerAttack",
    createdAtPulse: patch.createdAtPulse ?? 1,
  }).intent;
}

export function collectEvents() {
  const events = [];
  return { events, onEvent: (entry) => events.push(entry) };
}
