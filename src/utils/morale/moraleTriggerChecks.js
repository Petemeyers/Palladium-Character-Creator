import { isCombatantFled } from "../combatFledState.js";
import { isAllyOf, isHostileTo } from "../factionDisposition.js";
import { getActorAttributes, getAttributeMod, hasTrait } from "./moraleAttributes.js";
import { performMoraleCheck, normalizeMoraleState } from "./moraleChecks.js";
import { MORALE_STATES, ROUT_REASONS } from "./moraleConstants.js";

const MYTHIC_TERROR_TRAITS = Object.freeze([
  "terrifying_presence",
  "mythic_terror",
]);

const normalizeText = (value) => String(value || "").trim().toLowerCase();
const isExplicitCommander = (actor = {}) => {
  const tags = [
    ...(Array.isArray(actor.tags) ? actor.tags : []),
    ...(Array.isArray(actor.aiTags) ? actor.aiTags : []),
  ].map(normalizeText);
  return normalizeText(actor.aiRole) === "commander" ||
    normalizeText(actor.role) === "commander" ||
    tags.includes("commander");
};

const isDefeated = (actor = {}) => {
  const hp = Number(actor.currentHP ?? actor.HP ?? actor.hp ?? actor.hitPoints);
  return actor.isDead === true || actor.defeated === true ||
    (Number.isFinite(hp) && hp <= 0) ||
    ["dead", "defeated"].includes(normalizeText(actor.status)) ||
    normalizeText(actor.condition).includes("dead");
};

const isActive = (actor = {}) => !isCombatantFled(actor) && !isDefeated(actor) && !actor.isKO;
const emitsMythicTerror = (actor = {}) => MYTHIC_TERROR_TRAITS.some((trait) => hasTrait(actor, trait));

function getAdjacentActors(actor, fighters, positions, calculateDistance) {
  const actorPosition = positions?.[actor?.id];
  if (!actorPosition || typeof calculateDistance !== "function") return [];
  return (Array.isArray(fighters) ? fighters : []).filter((candidate) => {
    if (!candidate || candidate.id === actor.id || !isActive(candidate)) return false;
    const candidatePosition = positions?.[candidate.id];
    if (!candidatePosition) return false;
    return Number(calculateDistance(actorPosition, candidatePosition)) <= 5.01;
  });
}

function getBadlyWounded(actor = {}) {
  const currentHP = Number(actor.currentHP ?? actor.HP ?? actor.hp ?? actor.hitPoints);
  const maxHP = Number(actor.maxHP ?? actor.totalHP ?? actor.hpMax ?? actor.maxHitPoints);
  return Number.isFinite(currentHP) && Number.isFinite(maxHP) &&
    currentHP > 0 && maxHP > 0 && currentHP / maxHP <= 0.2;
}

function getTriggerCandidates(actor, context) {
  const sceneContext = context.sceneContext || { sceneType: "combat", relations: {} };
  const adjacent = getAdjacentActors(
    actor,
    context.fighters,
    context.positions,
    context.calculateDistance,
  );
  const adjacentEnemies = adjacent.filter((candidate) => isHostileTo(actor, candidate, sceneContext));
  const terrorSources = adjacentEnemies.filter(emitsMythicTerror);
  const deadLeader = (Array.isArray(context.fighters) ? context.fighters : []).find((candidate) => (
    candidate?.id !== actor.id &&
    isExplicitCommander(candidate) &&
    isDefeated(candidate) &&
    isAllyOf(actor, candidate, sceneContext)
  ));
  const terrorSource = terrorSources.sort((left, right) => (
    getActorAttributes(right).presence - getActorAttributes(left).presence
  ))[0] || null;

  return [
    terrorSource ? {
      id: "mythicTerror",
      memoryKey: "mythicTerrorTurn",
      routReason: ROUT_REASONS.MYTHIC_TERROR,
      dc: 17,
      context: {
        mythicTerror: true,
        terrorSource,
        terrorPenalty: Math.max(1, getAttributeMod(getActorAttributes(terrorSource).presence)),
      },
    } : null,
    deadLeader ? {
      id: "leaderDead",
      memoryKey: "leaderDeadTurn",
      routReason: ROUT_REASONS.LEADER_DEATH,
      dc: 15,
      context: { leaderDead: true, leaderId: deadLeader.id },
    } : null,
    adjacentEnemies.length >= 2 ? {
      id: "surrounded",
      memoryKey: "surroundedTurn",
      routReason: ROUT_REASONS.OUTNUMBERED,
      dc: 14,
      context: { outnumbered: true, surrounded: true },
    } : null,
    getBadlyWounded(actor) ? {
      id: "badlyWounded",
      memoryKey: "badlyWoundedTurn",
      routReason: ROUT_REASONS.WOUND_SHOCK,
      dc: 13,
      context: { badlyWounded: true },
    } : null,
  ].filter(Boolean);
}

export function evaluateMoraleTriggers(actor = {}, context = {}, rng = Math.random) {
  const normalized = normalizeMoraleState(actor);
  if (normalized.state.hasFledBattle || isCombatantFled(normalized)) {
    return { actor: normalized, result: "already_fled", skipped: true, trigger: null };
  }
  if (context.routingEnabled === false) {
    return { actor: normalized, result: "routing_disabled", skipped: true, trigger: null };
  }
  if ([MORALE_STATES.ROUTED, MORALE_STATES.BROKEN].includes(normalized.state.moraleState)) {
    return { actor: normalized, result: "already_routed", skipped: true, trigger: null };
  }

  const turnKey = context.turnKey;
  const memory = { ...(normalized.state.moraleTriggerMemory || {}) };
  if (turnKey != null && memory.lastMoraleCheckTurn === turnKey) {
    return { actor: normalized, result: "already_checked", skipped: true, trigger: null };
  }

  const trigger = getTriggerCandidates(normalized, context).find((candidate) => (
    turnKey == null || memory[candidate.memoryKey] !== turnKey
  ));
  if (!trigger) return { actor: normalized, result: "no_trigger", skipped: true, trigger: null };

  const nextMemory = {
    ...memory,
    [trigger.memoryKey]: turnKey,
    ...(turnKey != null ? { lastMoraleCheckTurn: turnKey } : {}),
  };
  // TODO: add an ally-victory modifier when combat exposes a reliable recent-kill event.
  const moraleContext = {
    routingEnabled: true,
    routReason: trigger.routReason,
    dc: trigger.dc,
    allyVictoryBonus: 0,
    ...trigger.context,
  };
  const checked = performMoraleCheck({
    ...normalized,
    state: { ...normalized.state, moraleTriggerMemory: nextMemory },
  }, moraleContext, rng);
  const routed = [MORALE_STATES.ROUTED, MORALE_STATES.BROKEN].includes(checked.actor.state.moraleState);
  const resultActor = {
    ...checked.actor,
    moraleState: {
      ...(checked.actor.moraleState || {}),
      status: routed ? "ROUTED" : checked.actor.state.moraleState.toUpperCase(),
      hasFled: false,
    },
    statusEffects: routed
      ? Array.from(new Set([...(checked.actor.statusEffects || []), "ROUTED"]))
      : checked.actor.statusEffects,
  };

  return {
    ...checked,
    actor: resultActor,
    skipped: false,
    trigger: trigger.id,
    triggerContext: moraleContext,
  };
}

export { emitsMythicTerror };
