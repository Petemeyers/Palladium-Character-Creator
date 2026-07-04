// src/utils/routingSystem.js

import { isCombatantFled } from "./combatFledState.js";
import { isCombatantBroken } from "./combatBrokenState.js";
import { isAllyOf, isHostileTo } from "./factionDisposition.js";
import { getActorAttributes, getAttributeMod } from "./morale/moraleAttributes.js";
import { attemptRoutRecovery, normalizeMoraleState } from "./morale/moraleChecks.js";
import { MORALE_STATES } from "./morale/moraleConstants.js";
import {
  chooseSurvivalIntent,
  getRoutingArmorProfile,
  getStaminaRoutingProfile,
  SURVIVAL_INTENT_THRESHOLDS,
  SURVIVAL_INTENTS,
} from "./survivalIntent.js";

const finiteNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const isExplicitCommander = (actor = {}) => {
  const tags = [
    ...(Array.isArray(actor.tags) ? actor.tags : []),
    ...(Array.isArray(actor.aiTags) ? actor.aiTags : []),
  ]
    .map((tag) => String(tag || "").trim().toLowerCase());
  return actor.aiRole === "commander" || actor.role === "commander" || tags.includes("commander");
};

const isLivingBattleActor = (actor = {}) => {
  if (!actor || isCombatantFled(actor) || isCombatantBroken(actor) || actor.isDead || actor.isKO) return false;
  const hp = Number(actor.currentHP ?? actor.HP ?? actor.hp ?? actor.hitPoints);
  return !Number.isFinite(hp) || hp > 0;
};

export function buildRoutRecoveryContext({
  actor,
  fighters = [],
  positions = {},
  calculateDistance,
  sceneContext = { sceneType: "combat", relations: {} },
} = {}) {
  const actorPosition = positions?.[actor?.id];
  const canMeasureDistance = actorPosition && typeof calculateDistance === "function";
  const nearbyAllies = [];
  const adjacentEnemies = [];

  if (canMeasureDistance) {
    fighters.forEach((candidate) => {
      if (!candidate || candidate.id === actor?.id || !isLivingBattleActor(candidate)) return;
      const candidatePosition = positions?.[candidate.id];
      if (!candidatePosition) return;
      const distance = finiteNumber(calculateDistance(actorPosition, candidatePosition), Infinity);
      if (distance <= 5.01 && isAllyOf(actor, candidate, sceneContext)) nearbyAllies.push(candidate);
      if (distance <= 5.01 && isHostileTo(actor, candidate, sceneContext)) adjacentEnemies.push(candidate);
    });
  }

  const commander = nearbyAllies.find(isExplicitCommander) || null;
  const currentHP = Number(actor?.currentHP ?? actor?.HP ?? actor?.hp ?? actor?.hitPoints);
  const maxHP = Number(actor?.maxHP ?? actor?.totalHP ?? actor?.hpMax ?? actor?.maxHitPoints);
  const badlyWounded = Number.isFinite(currentHP) && Number.isFinite(maxHP) && maxHP > 0
    ? currentHP / maxHP <= 0.2
    : false;
  const staminaProfile = getStaminaRoutingProfile(actor);
  const armorProfile = getRoutingArmorProfile(actor);

  return {
    allowRecoveryWhenRoutingDisabled: true,
    commanderNearby: Boolean(commander),
    commanderPresenceBonus: commander
      ? getAttributeMod(getActorAttributes(commander).presence)
      : 0,
    alliesNearby: nearbyAllies.length,
    enemyAdjacent: adjacentEnemies.length > 0,
    surrounded: adjacentEnemies.length >= 2,
    badlyWounded,
    inCover: false,
    nearWalls: false,
    mythicTerrorNearby: false,
    staminaRallyBonus: staminaProfile.band === "fresh" ? 1 : staminaProfile.band === "tired" ? -1 : staminaProfile.band === "exhausted" ? -2 : 0,
    armorConfidenceBonus: armorProfile.heavy ? 1 : 0,
  };
}

export function resolveRoutedTurnRecovery({
  actor,
  fighters = [],
  positions = {},
  calculateDistance,
  sceneContext,
  turnKey,
  rng = Math.random,
} = {}) {
  const normalized = normalizeMoraleState(actor);
  if (normalized.state.hasFledBattle || isCombatantFled(normalized)) {
    return { actor: normalized, result: "already_fled", skipped: true, recovered: false, context: {} };
  }
  if (![MORALE_STATES.ROUTED, MORALE_STATES.BROKEN].includes(normalized.state.moraleState)) {
    return { actor: normalized, result: "not_routed", skipped: true, recovered: false, context: {} };
  }
  if (turnKey != null && normalized.state.lastRecoveryTurnKey === turnKey) {
    return { actor: normalized, result: "already_attempted", skipped: true, recovered: false, context: {} };
  }

  const context = buildRoutRecoveryContext({
    actor: normalized,
    fighters,
    positions,
    calculateDistance,
    sceneContext,
  });
  const recovery = attemptRoutRecovery(normalized, context, rng);
  const recovered = ["strong_recovery", "partial_recovery"].includes(recovery.result);
  const recoveryActor = {
    ...recovery.actor,
    ...(recovered ? { inBattle: true, remainingActions: 0 } : {}),
    state: {
      ...recovery.actor.state,
      ...(turnKey != null ? { lastRecoveryTurnKey: turnKey } : {}),
    },
    ...(recovered ? {
      moraleState: {
        ...(recovery.actor.moraleState || {}),
        status: recovery.actor.state.moraleState.toUpperCase(),
        hasFled: false,
      },
      statusEffects: Array.isArray(recovery.actor.statusEffects)
        ? recovery.actor.statusEffects.filter((effect) => String(effect).toUpperCase() !== "ROUTED")
        : recovery.actor.statusEffects,
    } : {}),
  };

  return { ...recovery, actor: recoveryActor, recovered, context };
}

/**
 * Get a list of hex positions for threats (enemies to the router).
 */
export const HUMAN_ROUTING_PROFILE = Object.freeze({
  id: "human_panic",
  triggerStyle: "humanoid",
  exitMode: "map_edge",
  pathStyle: "panic",
  safeDistanceFt: 0,
  regroupAfterRounds: 0,
  canRally: false,
  corneredBehavior: "surrender",
  ignoresFormation: false,
  ignoresLeaderAnchor: false,
  avoidCrowds: false,
  prefersCover: false,
});

export const LARGE_HEAVY_PREDATOR_ROUTING_PROFILE = Object.freeze({
  id: "heavy_predator",
  triggerStyle: "opponent",
  exitMode: "safe_distance",
  pathStyle: "break_contact",
  safeDistanceFt: 120,
  regroupAfterRounds: 2,
  canRally: true,
  corneredBehavior: "berserk",
  ignoresFormation: true,
  ignoresLeaderAnchor: true,
  avoidCrowds: true,
  prefersCover: false,
});

export const TERRITORIAL_BEAST_ROUTING_PROFILE = Object.freeze({
  id: "territorial_beast",
  triggerStyle: "opponent",
  exitMode: "safe_distance",
  pathStyle: "break_contact",
  safeDistanceFt: 90,
  regroupAfterRounds: 1,
  canRally: false,
  corneredBehavior: "fight",
  ignoresFormation: true,
  ignoresLeaderAnchor: true,
  avoidCrowds: true,
  prefersCover: false,
});

export function getRoutingProfile(fighter) {
  if (fighter?.routingProfile && typeof fighter.routingProfile === "object") {
    return {
      ...HUMAN_ROUTING_PROFILE,
      ...fighter.routingProfile,
    };
  }

  if (fighter?.aiProfile === "territorial_behemoth") {
    return LARGE_HEAVY_PREDATOR_ROUTING_PROFILE;
  }

  if (
    fighter?.type === "enemy" &&
    fighter?.canSurrender === false &&
    !fighter?.neverFlee &&
    fighter?.aiProfile
  ) {
    return TERRITORIAL_BEAST_ROUTING_PROFILE;
  }

  return HUMAN_ROUTING_PROFILE;
}

export function getThreatPositionsForFighter(fighter, fighters, positions) {
  if (!fighter || !Array.isArray(fighters) || !positions) return [];

  const sameSideType = fighter.type;

  return fighters
    .filter(
      (f) =>
        f.id !== fighter.id &&
        f.type !== sameSideType &&
        !f.isDead &&
        !f.isKO &&
        !isCombatantFled(f) &&
        !isCombatantBroken(f)
    )
    .map((f) => positions[f.id])
    .filter(Boolean);
}

/**
 * Factory to create an occupancy checker, ignoring a specific fighter id.
 */
export function makeIsHexOccupied(positions, ignoreId = null) {
  return (x, y, ignore = ignoreId) =>
    Object.entries(positions).some(([id, pos]) => {
      if (ignore && String(id) === String(ignore)) return false;
      if (!pos) return false;
      return pos.x === x && pos.y === y;
    });
}

/**
 * Simple "at edge" check for treating a routed fighter as off-board.
 */
export function isAtMapEdge(pos, gridWidth, gridHeight) {
  if (!pos) return false;

  return (
    pos.x === 0 ||
    pos.y === 0 ||
    pos.x === gridWidth - 1 ||
    pos.y === gridHeight - 1
  );
}

export function hasCrossedRoutedEscapeBoundary(position, bounds = {}) {
  if (!position) return false;
  const minX = Number.isFinite(Number(bounds.minX)) ? Number(bounds.minX) : 0;
  const minY = Number.isFinite(Number(bounds.minY)) ? Number(bounds.minY) : 0;
  const maxX = Number.isFinite(Number(bounds.maxX))
    ? Number(bounds.maxX)
    : Math.max(minX, Number(bounds.gridWidth ?? bounds.width ?? 1) - 1);
  const maxY = Number.isFinite(Number(bounds.maxY))
    ? Number(bounds.maxY)
    : Math.max(minY, Number(bounds.gridHeight ?? bounds.height ?? 1) - 1);
  return Number(position.x) <= minX || Number(position.x) >= maxX ||
    Number(position.y) <= minY || Number(position.y) >= maxY;
}

const actorStrengthScore = (actor = {}) => {
  const hp = finiteNumber(actor.currentHP ?? actor.HP ?? actor.hp ?? actor.hitPoints);
  const maxHp = Math.max(1, finiteNumber(actor.maxHP ?? actor.totalHP ?? actor.hpMax ?? actor.maxHitPoints, hp || 1));
  const armor = finiteNumber(actor.armorClass ?? actor.ac ?? actor.derivedStats?.armorClass);
  const strength = finiteNumber(actor.abilityScores?.strength ?? actor.attributes?.strength ?? actor.Str);
  return hp / maxHp * 10 + armor + strength;
};

export function buildSurvivalIntentContext({
  actor,
  fighters = [],
  positions = {},
  calculateDistance,
  sceneContext = { sceneType: "combat", relations: {} },
} = {}) {
  const actorPosition = positions?.[actor?.id];
  const distanceFromActor = (candidate) => {
    const position = positions?.[candidate?.id];
    if (!actorPosition || !position || typeof calculateDistance !== "function") return Infinity;
    return finiteNumber(calculateDistance(actorPosition, position), Infinity);
  };
  const living = (Array.isArray(fighters) ? fighters : []).filter((candidate) => (
    candidate?.id !== actor?.id && isLivingBattleActor(candidate) && positions?.[candidate.id]
  ));
  const allies = living.filter((candidate) => isAllyOf(actor, candidate, sceneContext));
  const enemies = living.filter((candidate) => isHostileTo(actor, candidate, sceneContext));
  const nearbyAllies = allies.filter((candidate) => distanceFromActor(candidate) <= 30.01)
    .sort((left, right) => distanceFromActor(left) - distanceFromActor(right));
  const nearbyLeader = allies.filter(isExplicitCommander)
    .filter((candidate) => distanceFromActor(candidate) <= 60.01)
    .sort((left, right) => distanceFromActor(left) - distanceFromActor(right))[0] || null;
  const strongestAlly = allies.slice().sort((left, right) => actorStrengthScore(right) - actorStrengthScore(left))[0] || null;
  const teamCenter = allies.length >= 2 ? {
    x: allies.reduce((sum, ally) => sum + finiteNumber(positions[ally.id].x), 0) / allies.length,
    y: allies.reduce((sum, ally) => sum + finiteNumber(positions[ally.id].y), 0) / allies.length,
  } : null;
  const currentHP = Number(actor?.currentHP ?? actor?.HP ?? actor?.hp ?? actor?.hitPoints);
  const maxHP = Number(actor?.maxHP ?? actor?.totalHP ?? actor?.hpMax ?? actor?.maxHitPoints);
  const badlyWounded = Number.isFinite(currentHP) && Number.isFinite(maxHP) && maxHP > 0
    ? currentHP / maxHP <= SURVIVAL_INTENT_THRESHOLDS.badlyWoundedHpRatio
    : false;
  const routReason = String(actor?.state?.routReason || actor?.moraleState?.routReason || "").toLowerCase();

  return {
    allies,
    enemies,
    nearbyAllies,
    nearbyLeader,
    teamCenter,
    strongestAlly,
    badlyWounded,
    isolated: allies.every((candidate) => distanceFromActor(candidate) > 60.01),
    adjacentThreats: enemies.filter((candidate) => distanceFromActor(candidate) <= 5.01).length,
    mythicTerror: routReason === "mythicterror",
  };
}

export function chooseRoutingSurvivalIntent(options = {}) {
  const context = buildSurvivalIntentContext(options);
  const actor = options.actor || {};
  const moraleState = String(actor?.state?.moraleState || actor?.moraleState?.status || "").toLowerCase();
  return {
    ...chooseSurvivalIntent({
      fighter: actor,
      routed: ["routed", "broken"].includes(moraleState),
      moraleFailureMargin: finiteNumber(actor?.state?.moraleFailureMargin),
      ...context,
    }),
    context,
  };
}

export function canAttemptRallyFromRouting({
  fighter,
  enemies = [],
  positions = {},
  calculateDistance,
  pursuitRangeFeet = 30,
} = {}) {
  const fighterPos = positions?.[fighter?.id];
  if (!fighter || !fighterPos || typeof calculateDistance !== "function") {
    return { canAttempt: false, reason: "missing-position" };
  }
  const pursuer = (Array.isArray(enemies) ? enemies : []).find((enemy) => {
    if (!enemy || isCombatantFled(enemy) || isCombatantBroken(enemy) || !positions?.[enemy.id]) return false;
    const hp = Number(enemy.currentHP ?? enemy.HP ?? enemy.hp ?? enemy.hitPoints);
    const status = String(enemy.status || enemy.condition || "").toLowerCase();
    if ((Number.isFinite(hp) && hp <= 0) || /dead|unconscious|dying/.test(status)) return false;
    const fastOrAggressive = enemy.aiRole === "pursuer" || enemy.aggression === "berserk" ||
      (enemy.tags || []).some((tag) => ["fast", "mythic", "pursuer"].includes(String(tag).toLowerCase()));
    const range = fastOrAggressive ? Math.max(60, pursuitRangeFeet) : pursuitRangeFeet;
    return calculateDistance(fighterPos, positions[enemy.id]) <= range;
  });
  return { canAttempt: !pursuer, reason: pursuer ? "hostile-in-pursuit-range" : "unpursued", pursuer: pursuer || null };
}

function normalizeBounds(mapBounds = {}) {
  const width = Number(mapBounds.width ?? mapBounds.gridWidth ?? mapBounds.maxX) || 1;
  const height = Number(mapBounds.height ?? mapBounds.gridHeight ?? mapBounds.maxY) || 1;
  const minX = Number.isFinite(Number(mapBounds.minX)) ? Number(mapBounds.minX) : 0;
  const minY = Number.isFinite(Number(mapBounds.minY)) ? Number(mapBounds.minY) : 0;
  const maxX = Number.isFinite(Number(mapBounds.maxX)) ? Number(mapBounds.maxX) : minX + width - 1;
  const maxY = Number.isFinite(Number(mapBounds.maxY)) ? Number(mapBounds.maxY) : minY + height - 1;
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function getEdgeHexes(bounds) {
  const out = [];
  for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
    out.push({ x, y: bounds.minY });
    if (bounds.maxY !== bounds.minY) out.push({ x, y: bounds.maxY });
  }
  for (let y = bounds.minY + 1; y <= bounds.maxY - 1; y += 1) {
    out.push({ x: bounds.minX, y });
    if (bounds.maxX !== bounds.minX) out.push({ x: bounds.maxX, y });
  }
  return out;
}

function keyOf(pos) {
  return `${pos.x},${pos.y}`;
}

function defaultNeighbors(pos) {
  const odd = Math.abs(pos.y % 2) === 1;
  const deltas = odd
    ? [[1, 0], [-1, 0], [0, -1], [1, -1], [0, 1], [1, 1]]
    : [[1, 0], [-1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]];
  return deltas.map(([dx, dy]) => ({ x: pos.x + dx, y: pos.y + dy }));
}

function isThreatAdjacent(pos, threats, calculateDistance) {
  return threats.some((threat) => {
    if (!threat) return false;
    if (typeof calculateDistance === "function") return calculateDistance(pos, threat) <= 5.01;
    return Math.max(Math.abs(pos.x - threat.x), Math.abs(pos.y - threat.y)) <= 1;
  });
}

export function getClosestEscapeEdgeHex(router, threats = [], mapBounds = {}, occupiedHexes = {}, options = {}) {
  const start = router?.position || router?.hex || router;
  if (!start || !Number.isFinite(Number(start.x)) || !Number.isFinite(Number(start.y))) return null;

  const bounds = normalizeBounds(mapBounds);
  const threatPositions = (threats || []).map((t) => t?.position || t?.hex || t).filter(Boolean);
  const occupiedSet = occupiedHexes instanceof Set
    ? occupiedHexes
    : new Set(
        Array.isArray(occupiedHexes)
          ? occupiedHexes.map(keyOf)
          : Object.values(occupiedHexes || {}).filter(Boolean).map(keyOf)
      );
  const getNeighbors = options.getHexNeighbors || ((x, y) => defaultNeighbors({ x, y }));
  const calculateDistance = options.calculateDistance;
  const isInside = (p) => p.x >= bounds.minX && p.x <= bounds.maxX && p.y >= bounds.minY && p.y <= bounds.maxY;
  const isBlocked = (p) => occupiedSet.has(keyOf(p)) && keyOf(p) !== keyOf(start);
  const minThreatDistance = (p) => getMinimumThreatDistance(p, threatPositions, calculateDistance);
  const startThreatDistance = minThreatDistance(start);
  const edgeKeys = new Set(getEdgeHexes(bounds).map(keyOf));
  const center = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
  const nearestThreat = threatPositions
    .slice()
    .sort((a, b) => {
      if (typeof calculateDistance === "function") {
        return calculateDistance(start, a) - calculateDistance(start, b);
      }
      return Math.abs(Number(start.x) - Number(a.x)) + Math.abs(Number(start.y) - Number(a.y)) -
        (Math.abs(Number(start.x) - Number(b.x)) + Math.abs(Number(start.y) - Number(b.y)));
    })[0];
  const awayScore = (p) => {
    if (!nearestThreat) return 0;
    const awayX = Number(start.x) - Number(nearestThreat.x);
    const awayY = Number(start.y) - Number(nearestThreat.y);
    const edgeX = Number(p.x) - center.x;
    const edgeY = Number(p.y) - center.y;
    return awayX * edgeX + awayY * edgeY;
  };

  const cameFrom = new Map();
  const stepsByKey = new Map();
  const queue = [{ x: Number(start.x), y: Number(start.y) }];
  cameFrom.set(keyOf(start), null);
  stepsByKey.set(keyOf(start), 0);

  while (queue.length) {
    const pos = queue.shift();
    for (const next of getNeighbors(pos.x, pos.y)) {
      if (!isInside(next) || isBlocked(next)) continue;
      const key = keyOf(next);
      if (cameFrom.has(key)) continue;
      cameFrom.set(key, keyOf(pos));
      stepsByKey.set(key, (stepsByKey.get(keyOf(pos)) || 0) + 1);
      queue.push(next);
    }
  }

  let best = null;
  for (const edgeKey of edgeKeys) {
    if (!cameFrom.has(edgeKey)) continue;
    const [x, y] = edgeKey.split(",").map(Number);
    const candidate = { x, y };
    const steps = stepsByKey.get(edgeKey) || 0;
    const safety = minThreatDistance(candidate);
    const adjacentPenalty = isThreatAdjacent(candidate, threatPositions, calculateDistance) ? 1000 : 0;
    const improvesSafety = safety > startThreatDistance ? 500 : 0;
    const score = improvesSafety + safety + awayScore(candidate) * 0.25 - steps * 3 - adjacentPenalty;
    if (!best || score > best.score) {
      const path = [];
      let cursor = edgeKey;
      while (cursor) {
        const [px, py] = cursor.split(",").map(Number);
        path.unshift({ x: px, y: py });
        cursor = cameFrom.get(cursor);
      }
      best = { position: candidate, path, stepsMoved: steps, safetyScore: safety, score, reachedEdge: true };
    }
  }

  if (best) return best;

  const leastBad = [...cameFrom.keys()]
    .filter((k) => k !== keyOf(start))
    .map((k) => {
      const [x, y] = k.split(",").map(Number);
      const pos = { x, y };
      const path = [];
      let cursor = k;
      while (cursor) {
        const [px, py] = cursor.split(",").map(Number);
        path.unshift({ x: px, y: py });
        cursor = cameFrom.get(cursor);
      }
      return {
        position: pos,
        path,
        stepsMoved: stepsByKey.get(k) || 0,
        safetyScore: minThreatDistance(pos),
        reachedEdge: false,
        score: minThreatDistance(pos) + awayScore(pos) * 0.25,
      };
    })
    .sort((a, b) => b.score - a.score || b.safetyScore - a.safetyScore || b.stepsMoved - a.stepsMoved)[0];

  return leastBad || null;
}

export function getBestEscapeEdgeHex(router, threats = [], mapBounds = {}, occupiedHexes = {}, options = {}) {
  return getClosestEscapeEdgeHex(router, threats, mapBounds, occupiedHexes, options);
}

function getMinimumThreatDistance(position, threatPositions, calculateDistance) {
  if (
    !position ||
    !Array.isArray(threatPositions) ||
    threatPositions.length === 0 ||
    typeof calculateDistance !== "function"
  ) {
    return Number.POSITIVE_INFINITY;
  }

  return threatPositions.reduce((closest, threatPos) => {
    if (!threatPos) return closest;
    const distance = calculateDistance(position, threatPos);
    return Math.min(closest, distance);
  }, Number.POSITIVE_INFINITY);
}

/**
 * Generic retreat path finder.
 *
 * You can directly re-export your existing CombatPage findRetreatDestination logic into here,
 * or call this wrastaminar from that function.
 */
export function findBestRetreatHex({
  currentPos,
  threatPositions,
  maxSteps,
  isHexOccupied,
  getHexNeighbors,
  isValidPosition,
  calculateDistance,
  gridWidth,
  gridHeight,
  allowTieMoves = true,
  preferEdgeEscape = true,
}) {
  if (
    !currentPos ||
    !Array.isArray(threatPositions) ||
    threatPositions.length === 0 ||
    !maxSteps ||
    maxSteps <= 0
  ) {
    return null;
  }

  const minDistanceToThreats = (position) =>
    threatPositions.reduce((closest, threatPos) => {
      if (!threatPos) return closest;
      const distance = calculateDistance(position, threatPos);
      return Math.min(closest, distance);
    }, Number.POSITIVE_INFINITY);

  const EPS = 1e-6;
  const startingScore = minDistanceToThreats(currentPos);

  // --- Evaluate ALL reachable candidates within maxSteps (BFS), not greedy stepping ---
  // This prevents routed units from freezing when no single neighbor is strictly better.
  const keyOf = (p) => `${p.x},${p.y}`;
  const visited = new Map(); // key -> steps
  const queue = [{ pos: currentPos, steps: 0 }];
  visited.set(keyOf(currentPos), 0);

  while (queue.length) {
    const { pos, steps } = queue.shift();
    if (steps >= maxSteps) continue;

    const neighbors = getHexNeighbors(pos.x, pos.y)
      .filter((hex) => isValidPosition(hex.x, hex.y))
      .filter((hex) => !isHexOccupied(hex.x, hex.y));

    for (const n of neighbors) {
      const k = keyOf(n);
      if (visited.has(k)) continue;
      visited.set(k, steps + 1);
      queue.push({ pos: n, steps: steps + 1 });
    }
  }

  const isEdge =
    typeof gridWidth === "number" && typeof gridHeight === "number"
      ? (p) => isAtMapEdge(p, gridWidth, gridHeight)
      : () => false;

  let best = null;
  let bestSafety = -Infinity;
  let bestSteps = 0;
  let bestIsEdge = false;

  for (const [k, steps] of visited.entries()) {
    if (steps === 0) continue; // skip staying in place

    const [xStr, yStr] = k.split(",");
    const candidate = { x: Number(xStr), y: Number(yStr) };

    const candidateIsEdge = isEdge(candidate);
    const safety = minDistanceToThreats(candidate);

    // Tie-moves: allow equal safety scores (and tiny float noise) so units can "slide".
    const qualifies =
      (allowTieMoves && safety + EPS >= startingScore) ||
      (!allowTieMoves && safety > startingScore + EPS) ||
      (preferEdgeEscape && candidateIsEdge);

    if (!qualifies) continue;

    const edgeWins = preferEdgeEscape && candidateIsEdge && !bestIsEdge;
    const safetyWins =
      (!bestIsEdge || !preferEdgeEscape) && safety > bestSafety + EPS;
    const tieWins = Math.abs(safety - bestSafety) <= EPS && steps > bestSteps;

    if (!best || edgeWins || safetyWins || tieWins) {
      best = candidate;
      bestSafety = safety;
      bestSteps = steps;
      bestIsEdge = candidateIsEdge;
    }
  }

  if (!best) return null;

  return {
    position: best,
    stepsMoved: bestSteps,
    distanceFeet: calculateDistance(currentPos, best),
    safetyScore: bestSafety,
    reachedEdge: bestIsEdge,
  };
}

export function getSurvivalIntentTarget(intent, context = {}, positions = {}, threatPositions = []) {
  if (intent === SURVIVAL_INTENTS.FALL_BACK_TO_LEADER) {
    return positions?.[context.nearbyLeader?.id] || null;
  }
  if (intent === SURVIVAL_INTENTS.REGROUP_WITH_ALLY) {
    return positions?.[context.nearbyAllies?.[0]?.id] || null;
  }
  if (intent === SURVIVAL_INTENTS.WITHDRAW_TO_TEAM_CENTER) {
    return context.teamCenter || null;
  }
  if (intent === SURVIVAL_INTENTS.HIDE_BEHIND_STRONGEST_ALLY) {
    const allyPosition = positions?.[context.strongestAlly?.id];
    const threat = threatPositions?.[0];
    if (!allyPosition || !threat) return allyPosition || null;
    const dx = Number(allyPosition.x) - Number(threat.x);
    const dy = Number(allyPosition.y) - Number(threat.y);
    const scale = Math.max(1, Math.abs(dx), Math.abs(dy));
    return {
      x: Math.round(Number(allyPosition.x) + (dx / scale) * 2),
      y: Math.round(Number(allyPosition.y) + (dy / scale) * 2),
    };
  }
  return null;
}

export function getSurvivalMovementFailureReason({
  intent,
  context = {},
  positions = {},
  currentPos,
  threatPositions = [],
  maxSteps,
  getHexNeighbors,
  gridWidth,
  gridHeight,
} = {}) {
  if (!currentPos) return "no-current-position";
  if (!Number.isFinite(Number(maxSteps)) || Number(maxSteps) <= 0) return "no-movement-allowance";
  if (typeof getHexNeighbors !== "function") return "movement-helper-unavailable";
  const invalidGridArguments =
    (gridWidth != null && !Number.isFinite(Number(gridWidth))) ||
    (gridHeight != null && !Number.isFinite(Number(gridHeight)));
  if (invalidGridArguments) {
    return `invalid-grid-arguments gridWidthType=${typeof gridWidth} gridHeightType=${typeof gridHeight}`;
  }
  const targetedIntents = new Set([
    SURVIVAL_INTENTS.REGROUP_WITH_ALLY,
    SURVIVAL_INTENTS.FALL_BACK_TO_LEADER,
    SURVIVAL_INTENTS.WITHDRAW_TO_TEAM_CENTER,
    SURVIVAL_INTENTS.HIDE_BEHIND_STRONGEST_ALLY,
  ]);
  if (targetedIntents.has(intent) && !getSurvivalIntentTarget(intent, context, positions, threatPositions)) {
    return "no-valid-destination";
  }
  return "all-candidates-blocked";
}

/** Find a reachable formation-preserving destination for a non-panic intent. */
export function findSurvivalIntentDestination({
  intent,
  context = {},
  positions = {},
  currentPos,
  threatPositions = [],
  maxSteps,
  isHexOccupied,
  getHexNeighbors,
  isValidPosition,
  calculateDistance,
  gridWidth,
  gridHeight,
}) {
  if ([SURVIVAL_INTENTS.HOLD, SURVIVAL_INTENTS.COWER, SURVIVAL_INTENTS.SURRENDER].includes(intent)) {
    return currentPos ? { position: currentPos, stepsMoved: 0, distanceFeet: 0 } : null;
  }
  if (intent === SURVIVAL_INTENTS.DEFENSIVE_BACKSTEP) {
    return findBestRetreatHex({
      currentPos,
      threatPositions,
      maxSteps,
      isHexOccupied,
      getHexNeighbors,
      isValidPosition,
      calculateDistance,
      gridWidth,
      gridHeight,
      allowTieMoves: true,
      preferEdgeEscape: false,
    });
  }

  const target = getSurvivalIntentTarget(intent, context, positions, threatPositions);
  if (!currentPos || !target || !maxSteps || typeof getHexNeighbors !== "function") return null;
  const distance = typeof calculateDistance === "function"
    ? calculateDistance
    : (left, right) => Math.hypot(Number(left.x) - Number(right.x), Number(left.y) - Number(right.y));
  const valid = typeof isValidPosition === "function" ? isValidPosition : () => true;
  const occupied = typeof isHexOccupied === "function" ? isHexOccupied : () => false;
  const visited = new Map([[keyOf(currentPos), { pos: currentPos, steps: 0 }]]);
  const queue = [{ pos: currentPos, steps: 0 }];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current.steps >= maxSteps) continue;
    for (const next of getHexNeighbors(current.pos.x, current.pos.y)) {
      const key = keyOf(next);
      if (visited.has(key) || !valid(next.x, next.y) || occupied(next.x, next.y)) continue;
      const entry = { pos: next, steps: current.steps + 1 };
      visited.set(key, entry);
      queue.push(entry);
    }
  }

  const startThreatSafety = getMinimumThreatDistance(currentPos, threatPositions, distance);
  const candidates = [...visited.values()].filter((entry) => entry.steps > 0);
  const best = candidates.sort((left, right) => {
    const score = (entry) => {
      const targetDistance = finiteNumber(distance(entry.pos, target), Infinity);
      const threatSafety = getMinimumThreatDistance(entry.pos, threatPositions, distance);
      const safetyGain = Number.isFinite(startThreatSafety) && Number.isFinite(threatSafety)
        ? threatSafety - startThreatSafety
        : 0;
      return -targetDistance * 4 + safetyGain * 2 + entry.steps * 0.01;
    };
    return score(right) - score(left);
  })[0];
  if (!best) return null;
  return {
    position: best.pos,
    stepsMoved: best.steps,
    distanceFeet: finiteNumber(distance(currentPos, best.pos)),
    target,
  };
}

export function findRoutingDestination({
  currentPos,
  threatPositions,
  maxSteps,
  isHexOccupied,
  getHexNeighbors,
  isValidPosition,
  calculateDistance,
  gridWidth,
  gridHeight,
  routingProfile,
}) {
  const profile = {
    ...HUMAN_ROUTING_PROFILE,
    ...(routingProfile || {}),
  };

  return findBestRetreatHex({
    currentPos,
    threatPositions,
    maxSteps,
    isHexOccupied,
    getHexNeighbors,
    isValidPosition,
    calculateDistance,
    gridWidth,
    gridHeight,
    allowTieMoves: true,
    preferEdgeEscape: profile.exitMode === "map_edge",
  });
}

export function hasSatisfiedRoutingExit({
  position,
  threatPositions,
  calculateDistance,
  gridWidth,
  gridHeight,
  routingProfile,
}) {
  const profile = {
    ...HUMAN_ROUTING_PROFILE,
    ...(routingProfile || {}),
  };

  if (!position) return false;

  if (profile.exitMode === "map_edge") {
    return isAtMapEdge(position, gridWidth, gridHeight);
  }

  if (profile.exitMode === "safe_distance") {
    const minThreatDistance = getMinimumThreatDistance(
      position,
      threatPositions,
      calculateDistance
    );
    return minThreatDistance >= Math.max(5, Number(profile.safeDistanceFt) || 0);
  }

  return false;
}
