import { calculateDistance } from "../../data/movementRules.js";
import { getCombatActorId } from "../combatActorIdentity.js";
import { createTacticalActionIntent } from "./tacticalActionIntent.js";

const idOf = (actor) => String(getCombatActorId(actor) ?? "");
const positionOf = (positions, actor) => positions?.[idOf(actor)] || actor?.position || actor?.hex || actor;
const normalized = (value) => String(value ?? "").trim().toLowerCase();
const hasPositiveCombatHp = (actor = {}) => {
  const value = actor.currentHP ?? actor.currentHp ?? actor.hp ?? actor.hitPoints?.current ?? actor.health;
  return value === undefined || value === null || value === "" || Number(value) > 0;
};
const isTacticalCombatCapable = (actor = {}) => Boolean(
  actor && !actor.dead && !actor.isDead && !actor.unconscious && !actor.isUnconscious
  && !actor.defeated && !actor.isDefeated && actor.canAct !== false && hasPositiveCombatHp(actor),
);

export function isTacticalRangedAttack(attack = {}) {
  const kind = normalized(attack.kind || attack.type || attack.category || attack.attackType);
  return kind === "ranged" || attack.isRanged === true || Number(attack?.rangeProfile?.normal ?? attack.normalRangeFeet ?? attack.rangeFeet ?? attack.range) > 10;
}

export function getTacticalAttackReach(attack = {}) {
  return Number(attack.reachFeet ?? attack.reach ?? attack.rangeFeet ?? attack?.rangeProfile?.normal ?? attack.normalRangeFeet ?? attack.range ?? 5) || 5;
}

export function selectTacticalTimingKey({ attack = {}, actor = {}, targetDistance = Infinity, immediatelyThreatened = false } = {}) {
  const text = normalized(`${attack.id} ${attack.name} ${attack.weaponFamily} ${attack.techniqueId} ${attack.attackMode}`);
  if (/longbow|long bow/.test(text)) {
    if (immediatelyThreatened) return "longbowRushedShot";
    if (targetDistance > 60 && actor.aimedShotPreferred === true) return "longbowAimedShot";
    return "longbowStandardShot";
  }
  if (/crossbow/.test(text) && (attack.loaded === true || actor.crossbowLoaded === true)) return "loadedCrossbowShot";
  if (/half.?sword/.test(text)) return "halfSwordThrust";
  if (/heavy|great|maul|two.?hand/.test(text)) return "heavyMeleeAttack";
  if (/spear|pike|halberd/.test(text)) return "spearThrust";
  if (/long.?sword/.test(text)) return /thrust/.test(text) ? "longswordThrust" : "longswordCut";
  if (/short.?sword/.test(text)) return "shortSwordAttack";
  if (/dagger|knife/.test(text)) return "daggerAttack";
  if (/grapple|clinch/.test(text)) return "grappleEntry";
  return "unarmedQuickStrike";
}

export function getTacticalAttackOptions(actor = {}) {
  const candidates = [
    ...(Array.isArray(actor.attacks) ? actor.attacks : []),
    ...(Array.isArray(actor.weaponProfiles) ? actor.weaponProfiles : []),
  ];
  if (actor.selectedAttack) candidates.unshift(actor.selectedAttack);
  const seen = new Set();
  return candidates.filter((attack) => {
    const key = String(attack?.id ?? attack?.weaponId ?? attack?.name ?? "");
    if (!key || seen.has(key) || attack?.disabled || attack?.available === false) return false;
    seen.add(key);
    return true;
  });
}

export function planDefaultTacticalAction({
  actor,
  fighters = [],
  positions = {},
  pulseIndex,
  generationId,
  combatSession,
  actionSequence = 1,
  selectAttackTechnique,
} = {}) {
  const actorId = idOf(actor);
  const actorPosition = positionOf(positions, actor);
  if (!actorId || !actorPosition) return { accepted: false, reason: "actor-position-required" };
  const hostiles = fighters.filter((candidate) => (
    idOf(candidate) &&
    idOf(candidate) !== actorId &&
    candidate.team !== actor.team &&
    isTacticalCombatCapable(candidate)
  ));
  const attacks = getTacticalAttackOptions(actor);
  const options = [];
  for (const target of hostiles) {
    const targetPosition = positionOf(positions, target);
    if (!targetPosition) continue;
    const distance = calculateDistance(actorPosition, targetPosition);
    for (const attack of attacks) {
      const ranged = isTacticalRangedAttack(attack);
      const legalDistance = ranged ? distance <= getTacticalAttackReach(attack) : distance <= getTacticalAttackReach(attack);
      if (legalDistance) options.push({ target, attack, distance, ranged });
    }
  }
  options.sort((left, right) => left.distance - right.distance || idOf(left.target).localeCompare(idOf(right.target)));
  const selected = options[0];
  if (!selected) return { accepted: false, reason: "no-legal-tactical-attack" };
  const techniqueSelection = selected.ranged ? null : selectAttackTechnique?.({
    actor,
    target: selected.target,
    attack: selected.attack,
    distance: selected.distance,
  });
  const selectedTechnique = techniqueSelection?.selectedTechnique
    ?? selected.attack.techniqueId
    ?? selected.attack.attackMode
    ?? null;
  const weaponId = String(selected.attack.id ?? selected.attack.weaponId ?? selected.attack.name);
  const timingKey = selectTacticalTimingKey({
    attack: { ...selected.attack, techniqueId: selectedTechnique, attackMode: selectedTechnique },
    actor,
    targetDistance: selected.distance,
    immediatelyThreatened: hostiles.some((candidate) => calculateDistance(actorPosition, positionOf(positions, candidate)) <= 10),
  });
  return createTacticalActionIntent({
    actionIntentId: `${generationId}:${combatSession}:${pulseIndex}:${actorId}:attack:${actionSequence}`,
    generationId,
    combatSession,
    actorId,
    targetActorId: idOf(selected.target),
    actionType: selectedTechnique === "grapple" ? "grapple-entry" : selected.ranged ? "ranged-attack" : "melee-attack",
    techniqueId: selectedTechnique,
    weaponId,
    weaponFamily: selected.attack.weaponFamily ?? selected.attack.category ?? null,
    attackProfileId: selected.attack.attackProfileId ?? selected.attack.id ?? null,
    timingKey,
    createdAtPulse: pulseIndex,
    actionSequence,
    source: "tactical-ai",
  });
}

export function findTacticalAttackByIntent(actor, intent) {
  return getTacticalAttackOptions(actor).find((attack) => (
    String(attack.id ?? attack.weaponId ?? attack.name) === String(intent?.weaponId)
  )) || null;
}
