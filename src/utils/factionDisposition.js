import { isCombatantFled } from "./combatFledState.js";

const DISPOSITIONS = new Set([
  "ally",
  "friendly",
  "neutral",
  "suspicious",
  "hostile",
  "kill_on_sight",
]);

const HOSTILE_DISPOSITIONS = new Set(["hostile", "kill_on_sight"]);
const ALLY_DISPOSITIONS = new Set(["ally", "friendly"]);
const NEUTRAL_DISPOSITIONS = new Set(["neutral", "suspicious"]);
const HOSTILE_AGGRESSIONS = new Set(["hostile", "kill_on_sight", "berserk", "diabolic"]);
const LEGACY_COMBAT_SIDES = new Set(["player", "enemy"]);

const RACE_RELATIONS = {
  human: {
    allies: ["human", "human", "gnome"],
    enemies: ["wolf", "brigand", "hob-brigand", "raider", "brigand", "heavy fighter", "champion", "duelist"],
  },
  human: {
    allies: ["human", "scout"],
    enemies: ["human", "champion", "heavy fighter", "brigand", "hob-brigand", "raider", "gnome"],
  },
};

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeDisposition(value, fallback = "neutral") {
  const key = normalizeKey(value);
  return DISPOSITIONS.has(key) ? key : fallback;
}

function getRelationFromMap(relations, actorFaction, targetFaction) {
  if (!relations || !actorFaction || !targetFaction) return null;
  const direct = relations?.[actorFaction]?.[targetFaction];
  if (direct) return normalizeDisposition(direct, null);
  const flatKey = `${actorFaction}:${targetFaction}`;
  if (relations?.[flatKey]) return normalizeDisposition(relations[flatKey], null);
  return null;
}

function getRaceKey(fighter) {
  return normalizeKey(
    fighter?.race ||
      fighter?.species ||
      fighter?.combatantRace ||
      fighter?.ancestry ||
      fighter?.name
  );
}

function getRaceDisposition(actor, target) {
  const actorRace = getRaceKey(actor);
  const targetRace = getRaceKey(target);
  if (!actorRace || !targetRace || actorRace === targetRace) return null;

  const profile = RACE_RELATIONS[actorRace];
  if (!profile) return null;
  if (profile.enemies?.some((race) => targetRace.includes(race))) return "suspicious";
  if (profile.allies?.some((race) => targetRace.includes(race))) return "friendly";
  return null;
}

export function getTeamId(fighter) {
  return (
    fighter?.teamId ||
    fighter?.team ||
    fighter?.side ||
    fighter?.type ||
    "neutral"
  );
}

export function getFactionId(fighter) {
  return (
    fighter?.factionId ||
    fighter?.faction ||
    fighter?.teamId ||
    fighter?.side ||
    fighter?.type ||
    "neutral"
  );
}

function getExplicitTeamId(fighter) {
  return fighter?.teamId || fighter?.team || fighter?.side || null;
}

function getExplicitFactionId(fighter) {
  return fighter?.factionId || fighter?.faction || fighter?.teamId || fighter?.side || null;
}

export function getActorRole(fighter) {
  if (fighter?.role) return fighter.role;
  if (fighter?.type === "player") return "party";
  if (fighter?.type === "enemy") return "enemy";
  return "npc";
}

export function getAggression(fighter) {
  if (fighter?.aggression) return fighter.aggression;
  if (fighter?.type === "enemy") return "hostile";
  if (fighter?.type === "player") return "party";
  return "neutral";
}

export function getDisposition(actor, target, sceneContext = {}) {
  if (!actor || !target) return "neutral";
  if ((actor.id || actor._id) && (actor.id || actor._id) === (target.id || target._id)) {
    return "ally";
  }

  if (actor.attacksEveryone === true) return "hostile";

  const actorTeam = normalizeKey(getExplicitTeamId(actor));
  const targetTeam = normalizeKey(getExplicitTeamId(target));
  if (actorTeam && targetTeam && actorTeam === targetTeam) return "ally";

  const explicitActorFaction = normalizeKey(getExplicitFactionId(actor));
  const explicitTargetFaction = normalizeKey(getExplicitFactionId(target));
  if (explicitActorFaction && explicitTargetFaction && explicitActorFaction === explicitTargetFaction) return "friendly";

  const aggression = normalizeKey(actor.aggression);
  const disposition = normalizeKey(actor.disposition);
  if (HOSTILE_AGGRESSIONS.has(aggression) || HOSTILE_DISPOSITIONS.has(disposition)) return "hostile";

  const actorFaction = normalizeKey(getFactionId(actor));
  const targetFaction = normalizeKey(getFactionId(target));
  const actorRelations = actor.factionRelations || actor.relations;
  const actorRelation = getRelationFromMap(actorRelations, actorFaction, targetFaction);
  if (actorRelation) return actorRelation;

  const sceneRelation = getRelationFromMap(sceneContext.relations, actorFaction, targetFaction);
  if (sceneRelation) return sceneRelation;

  if (target.nonCombatant === true) return "neutral";

  const actorType = normalizeKey(actor?.type);
  const targetType = normalizeKey(target?.type);
  if (LEGACY_COMBAT_SIDES.has(actorType) && LEGACY_COMBAT_SIDES.has(targetType)) {
    return actorType !== targetType ? "hostile" : "ally";
  }

  const raceDisposition = getRaceDisposition(actor, target);
  if (raceDisposition) return raceDisposition;

  return "neutral";
}

export function isHostileTo(actor, target, sceneContext = {}) {
  return HOSTILE_DISPOSITIONS.has(getDisposition(actor, target, sceneContext));
}

export function isAllyOf(actor, target, sceneContext = {}) {
  return ALLY_DISPOSITIONS.has(getDisposition(actor, target, sceneContext));
}

export function isNeutralTo(actor, target, sceneContext = {}) {
  return NEUTRAL_DISPOSITIONS.has(getDisposition(actor, target, sceneContext));
}

export function canDialogueWith(actor, target, sceneContext = {}) {
  if (!actor || !target) return false;
  const disposition = getDisposition(actor, target, sceneContext);
  if (disposition === "kill_on_sight" || disposition === "hostile") return false;
  return Boolean(target.canDialogue || target.dialogueState || target.role === "merchant" || target.role === "civilian");
}

export function canTargetForAction(actor, target, actionKind = "attack", sceneContext = {}) {
  if (!actor || !target) return false;
  if (isCombatantFled(actor) || isCombatantFled(target)) return false;
  if ((actor.id || actor._id) && (actor.id || actor._id) === (target.id || target._id)) {
    const shumanKind = normalizeKey(actionKind);
    return ["shuman", "heal", "buff", "assist"].includes(shumanKind);
  }

  const kind = normalizeKey(actionKind);
  if (["attack", "attack", "grapple", "techniquehostile", "tacticalhostile"].includes(kind)) {
    return isHostileTo(actor, target, sceneContext);
  }
  if (["heal", "buff", "assist"].includes(kind)) {
    return isAllyOf(actor, target, sceneContext);
  }
  if (["dialogue", "talk", "trade"].includes(kind)) {
    return canDialogueWith(actor, target, sceneContext);
  }

  return false;
}
