import {
  BATTLEFIELD_FOG,
  BATTLEFIELD_LIGHTING,
  normalizeBattlefieldMap,
} from "./battlefieldMapAuthority.js";
import {
  getBattlefieldPropDefinition,
  getBattlefieldPropOffset as getCatalogBattlefieldPropOffset,
} from "./battlefieldPropCatalog.js";
import {
  resolveBattlefieldLocalEnvironmentAtCell,
  resolveBattlefieldLocalVisualRange,
} from "./battlefieldLocalEnvironmentAuthority.js";

const CELL_SIZE_FEET = 5;
const DEFAULT_EYE_HEIGHT_FEET = 5;
const DEFAULT_ELEVATION_STEP_FEET = 5;

const LIGHTING_VISUAL_RANGE_FEET = Object.freeze({
  [BATTLEFIELD_LIGHTING.BRIGHT_DAYLIGHT]: 120,
  [BATTLEFIELD_LIGHTING.DAYLIGHT]: 120,
  [BATTLEFIELD_LIGHTING.DUSK]: 80,
  [BATTLEFIELD_LIGHTING.MOONLIGHT]: 60,
  [BATTLEFIELD_LIGHTING.TORCHLIGHT]: 30,
  [BATTLEFIELD_LIGHTING.DARKNESS]: 5,
});

const TERRAIN_OCCLUSION = Object.freeze({
  forest: 0.28,
  rubble: 0.08,
  "uneven-ground": 0.04,
  mud: 0.02,
  "narrow-passage": 0.02,
});


const toFinite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const normalizeText = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
const cellKey = (x, y) => `${Number(x)},${Number(y)}`;

export function resolveBattlefieldFighterTeam(fighter = null) {
  if (!fighter) return null;
  const explicit = fighter.team || fighter.side || fighter.armyId || fighter.factionId;
  if (explicit) {
    const normalized = normalizeText(explicit);
    if (/^(party|player|players|ally|allies|friendly|friendlies)$/.test(normalized)) return "party";
    if (/^(enemy|enemies|hostile|hostiles|opponent|opponents)$/.test(normalized)) return "enemy";
    return normalized;
  }
  if (fighter.type === "player" || fighter.controlMode === "player" || fighter.isEnemy === false) return "party";
  if (fighter.type === "enemy" || fighter.controlMode === "enemy" || fighter.isEnemy === true) return "enemy";
  return null;
}

function isCombatantAvailable(fighter = null) {
  if (!fighter) return false;
  const hp = Number(fighter.currentHP ?? fighter.HP ?? fighter.hp);
  const status = normalizeText(fighter.status || fighter.state);
  if (fighter.dead || fighter.isDead || fighter.defeated || fighter.hasFled || fighter.fled || fighter.unconscious || fighter.isUnconscious) return false;
  if (Number.isFinite(hp) && hp <= -20) return false;
  if (["dead", "defeated", "fled", "removed", "unconscious"].includes(status)) return false;
  return true;
}

function oddRToCube(position) {
  const row = Number(position?.y) || 0;
  const col = Number(position?.x) || 0;
  const q = col - ((row - (row & 1)) / 2);
  const r = row;
  return { x: q, z: r, y: -q - r };
}

function cubeToOddR(cube) {
  const r = Number(cube?.z) || 0;
  const q = Number(cube?.x) || 0;
  return {
    x: q + ((r - (r & 1)) / 2),
    y: r,
  };
}

function cubeRound(cube) {
  let rx = Math.round(cube.x);
  let ry = Math.round(cube.y);
  let rz = Math.round(cube.z);
  const dx = Math.abs(rx - cube.x);
  const dy = Math.abs(ry - cube.y);
  const dz = Math.abs(rz - cube.z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return { x: rx, y: ry, z: rz };
}

function cubeDistance(a, b) {
  return Math.max(
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y),
    Math.abs(a.z - b.z),
  );
}

export function getBattlefieldDistanceHexes(from, to, mapType = "hex") {
  if (!from || !to) return Number.POSITIVE_INFINITY;
  if (normalizeText(mapType) === "square") {
    return Math.max(Math.abs(Number(to.x) - Number(from.x)), Math.abs(Number(to.y) - Number(from.y)));
  }
  return cubeDistance(oddRToCube(from), oddRToCube(to));
}

export function getBattlefieldDistanceFeet(from, to, mapType = "hex", cellSizeFeet = CELL_SIZE_FEET) {
  return getBattlefieldDistanceHexes(from, to, mapType) * Math.max(1, toFinite(cellSizeFeet, CELL_SIZE_FEET));
}

function traceSquareLine(from, to) {
  let x0 = Math.round(Number(from.x));
  let y0 = Math.round(Number(from.y));
  const x1 = Math.round(Number(to.x));
  const y1 = Math.round(Number(to.y));
  const points = [];
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    points.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return points;
}

export function traceBattlefieldLine(from, to, mapType = "hex") {
  if (!from || !to) return [];
  if (normalizeText(mapType) === "square") return traceSquareLine(from, to);
  const a = oddRToCube(from);
  const b = oddRToCube(to);
  const distance = cubeDistance(a, b);
  if (distance <= 0) return [{ x: Number(from.x), y: Number(from.y) }];
  const points = [];
  const seen = new Set();
  for (let step = 0; step <= distance; step += 1) {
    const t = step / distance;
    const cube = cubeRound({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
    });
    const offset = cubeToOddR(cube);
    const key = cellKey(offset.x, offset.y);
    if (seen.has(key)) continue;
    seen.add(key);
    points.push(offset);
  }
  return points;
}

function getMapGridSource(battlefield) {
  return battlefield?.battlefieldMap?.grid || battlefield?.grid || [];
}

function getMapPropsSource(battlefield) {
  return battlefield?.battlefieldMap?.props || battlefield?.props || [];
}

export function getBattlefieldPropOffset(prop = {}, map = null) {
  return getCatalogBattlefieldPropOffset(prop, map);
}

function buildPropLookup(battlefield) {
  const map = battlefield?.battlefieldMap || battlefield;
  const lookup = new Map();
  for (const prop of getMapPropsSource(battlefield)) {
    const pos = getBattlefieldPropOffset(prop, map);
    if (!pos) continue;
    const key = cellKey(pos.x, pos.y);
    const list = lookup.get(key) || [];
    list.push(prop);
    lookup.set(key, list);
  }
  return lookup;
}

function getCell(grid, x, y) {
  return Array.isArray(grid?.[y]) ? grid[y][x] || null : null;
}

function getCellElevationFeet(cell, elevationStepFeet) {
  const level = toFinite(cell?.elevation ?? cell?.height, 0);
  return level * elevationStepFeet;
}

function getPropHeightFeet(prop = {}) {
  if (Number.isFinite(Number(prop.heightFeet))) return Math.max(0, Number(prop.heightFeet));
  return Math.max(0, Number(getBattlefieldPropDefinition(prop.type || prop.name)?.heightFeet) || 8);
}

function getCellOcclusion(cell = null) {
  if (!cell) return 0;
  const key = normalizeText(cell.formationType || cell.combatTerrainType || cell.terrainType || cell.terrain);
  return TERRAIN_OCCLUSION[key] ?? (key.includes("forest") ? TERRAIN_OCCLUSION.forest : 0);
}

export function resolveBattlefieldLineOfSight({
  from,
  to,
  battlefield,
  observerAltitudeFeet = 0,
  targetAltitudeFeet = 0,
  observerEyeHeightFeet = DEFAULT_EYE_HEIGHT_FEET,
  targetEyeHeightFeet = DEFAULT_EYE_HEIGHT_FEET,
  elevationStepFeet = DEFAULT_ELEVATION_STEP_FEET,
} = {}) {
  if (!from || !to) return { visible: false, hasLineOfSight: false, reason: "missing-position", blockedBy: null, trace: [] };
  const map = normalizeBattlefieldMap(battlefield?.battlefieldMap || battlefield || {});
  const grid = getMapGridSource(map);
  const line = traceBattlefieldLine(from, to, map.mapType);
  if (line.length <= 1) return { visible: true, hasLineOfSight: true, reason: "same-cell", blockedBy: null, trace: line, occlusion: 0 };
  const propLookup = buildPropLookup(map);
  const hasLocalAtmosphere = (Array.isArray(map.props) ? map.props : []).some((prop) => (
    prop?.localAtmosphere || getBattlefieldPropDefinition(prop?.type)?.localAtmosphere
  ));
  const fromCell = getCell(grid, from.x, from.y);
  const toCell = getCell(grid, to.x, to.y);
  const startEye = getCellElevationFeet(fromCell, elevationStepFeet) + Math.max(0, toFinite(observerAltitudeFeet, 0)) + Math.max(0, toFinite(observerEyeHeightFeet, DEFAULT_EYE_HEIGHT_FEET));
  const endEye = getCellElevationFeet(toCell, elevationStepFeet) + Math.max(0, toFinite(targetAltitudeFeet, 0)) + Math.max(0, toFinite(targetEyeHeightFeet, DEFAULT_EYE_HEIGHT_FEET));
  let occlusion = 0;

  for (let index = 1; index < line.length - 1; index += 1) {
    const point = line[index];
    const cell = getCell(grid, point.x, point.y);
    const progress = index / Math.max(1, line.length - 1);
    const lineHeightFeet = startEye + (endEye - startEye) * progress;
    const terrainTopFeet = getCellElevationFeet(cell, elevationStepFeet);

    if (cell?.blocksLineOfSight === true) {
      return {
        visible: false,
        hasLineOfSight: false,
        reason: "cell-blocks-line-of-sight",
        blockedBy: { x: point.x, y: point.y, type: "cell", cell },
        trace: line,
        occlusion,
      };
    }

    // Raised terrain can block a lower sight line even when the terrain type is
    // otherwise traversable. A one-level ridge between two ground observers is
    // enough to break LOS; elevated/airborne observers can see over it.
    if (terrainTopFeet >= lineHeightFeet - 0.25) {
      return {
        visible: false,
        hasLineOfSight: false,
        reason: "elevation-blocked",
        blockedBy: { x: point.x, y: point.y, type: "elevation", elevationFeet: terrainTopFeet },
        trace: line,
        occlusion,
      };
    }

    const props = propLookup.get(cellKey(point.x, point.y)) || [];
    for (const prop of props) {
      if (prop?.blocksLineOfSight !== true) continue;
      const propTopFeet = terrainTopFeet + getPropHeightFeet(prop);
      if (propTopFeet >= lineHeightFeet - 0.25) {
        return {
          visible: false,
          hasLineOfSight: false,
          reason: "prop-blocked",
          blockedBy: { x: point.x, y: point.y, type: "prop", prop, topFeet: propTopFeet },
          trace: line,
          occlusion,
        };
      }
    }

    occlusion += getCellOcclusion(cell);
    const localEnvironment = hasLocalAtmosphere
      ? resolveBattlefieldLocalEnvironmentAtCell({ battlefield: map, position: point })
      : { smokeOcclusion: 0, smokeSources: [] };
    if (localEnvironment.smokeOcclusion > 0) occlusion += localEnvironment.smokeOcclusion;
    if (occlusion >= 1) {
      return {
        visible: false,
        hasLineOfSight: false,
        reason: "terrain-concealment-blocked",
        blockedBy: { x: point.x, y: point.y, type: localEnvironment.smokeOcclusion > 0 ? "smoke-concealment" : "terrain-concealment", occlusion, smoke: localEnvironment.smokeSources },
        trace: line,
        occlusion,
      };
    }
  }

  return { visible: true, hasLineOfSight: true, reason: occlusion > 0 ? "partially-obscured" : "clear-line-of-sight", blockedBy: null, trace: line, occlusion };
}

export function resolveBattlefieldVisualRange({
  observer = null,
  battlefield = null,
  overrideRangeFeet = null,
} = {}) {
  const map = normalizeBattlefieldMap(battlefield?.battlefieldMap || battlefield || {});
  const environment = map.environment || {};
  const lighting = environment.lighting || BATTLEFIELD_LIGHTING.BRIGHT_DAYLIGHT;
  const baseRange = Number.isFinite(Number(overrideRangeFeet)) && Number(overrideRangeFeet) > 0
    ? Number(overrideRangeFeet)
    : LIGHTING_VISUAL_RANGE_FEET[lighting] || 60;
  const specialRange = Math.max(
    0,
    toFinite(observer?.nightvisionRange, 0),
    toFinite(observer?.darkvisionRange, 0),
    toFinite(observer?.senses?.visualRangeFeet, 0),
  );
  let range = Math.max(baseRange, specialRange);
  const fog = environment.environmentalFog || {};
  const multiplier = Math.max(0.05, toFinite(fog.visibilityMultiplier, 1));
  range *= multiplier;
  const cap = Number(fog.maximumVisualRangeFeet);
  if (Number.isFinite(cap) && cap > 0) range = Math.min(range, cap);
  if (lighting === BATTLEFIELD_LIGHTING.DARKNESS && specialRange <= 0) range = Math.min(range, 5);
  const observerPosition = observer?.position || observer?.combatPosition || null;
  if (observerPosition) {
    const local = resolveBattlefieldLocalVisualRange({ battlefield: map, observerPosition, baseRangeFeet: range });
    range = Math.max(range, local.rangeFeet);
  }
  return Math.max(5, Math.floor(range));
}

export function resolveActorVisibility({
  observer,
  target,
  positions = {},
  battlefield,
  overrideRangeFeet = null,
} = {}) {
  const observerId = observer?.id || observer?._id;
  const targetId = target?.id || target?._id;
  const from = positions?.[observerId] || observer?.position;
  const to = positions?.[targetId] || target?.position;
  if (!observerId || !targetId || !from || !to) {
    return { visible: false, reason: "missing-actor-position", observerId, targetId, distanceFeet: null, rangeFeet: 0, los: null };
  }
  const map = normalizeBattlefieldMap(battlefield?.battlefieldMap || battlefield || {});
  const distanceFeet = getBattlefieldDistanceFeet(from, to, map.mapType);
  const baseRangeFeet = resolveBattlefieldVisualRange({ observer: { ...observer, position: from }, battlefield: map, overrideRangeFeet });
  const localRange = resolveBattlefieldLocalVisualRange({ battlefield: map, observerPosition: from, targetPosition: to, baseRangeFeet });
  const rangeFeet = Math.max(baseRangeFeet, localRange.rangeFeet);
  if (distanceFeet > rangeFeet) {
    return { visible: false, reason: "beyond-visual-range", observerId, targetId, distanceFeet, rangeFeet, los: null };
  }
  const los = resolveBattlefieldLineOfSight({
    from,
    to,
    battlefield: map,
    observerAltitudeFeet: observer?.flightState?.altitudeFeet ?? observer?.altitudeFeet ?? observer?.altitude ?? 0,
    targetAltitudeFeet: target?.flightState?.altitudeFeet ?? target?.altitudeFeet ?? target?.altitude ?? 0,
  });
  return {
    visible: los.hasLineOfSight,
    reason: los.hasLineOfSight ? los.reason : los.reason || "line-of-sight-blocked",
    observerId,
    targetId,
    distanceFeet,
    rangeFeet,
    los,
  };
}

export function calculateBattlefieldVisibleCellsForObserver({
  observer,
  position = null,
  battlefield,
  overrideRangeFeet = null,
} = {}) {
  const map = normalizeBattlefieldMap(battlefield?.battlefieldMap || battlefield || {});
  const from = position || observer?.position;
  if (!observer || !from) return [];
  const rangeFeet = resolveBattlefieldVisualRange({ observer: { ...observer, position: from }, battlefield: map, overrideRangeFeet });
  const maxHexes = Math.max(1, Math.ceil(rangeFeet / CELL_SIZE_FEET));
  const minX = Math.max(0, Math.floor(Number(from.x) - maxHexes));
  const maxX = Math.min(map.width - 1, Math.ceil(Number(from.x) + maxHexes));
  const minY = Math.max(0, Math.floor(Number(from.y) - maxHexes));
  const maxY = Math.min(map.height - 1, Math.ceil(Number(from.y) + maxHexes));
  const visible = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const to = { x, y };
      const distanceFeet = getBattlefieldDistanceFeet(from, to, map.mapType);
      if (distanceFeet > rangeFeet) continue;
      if (x === Number(from.x) && y === Number(from.y)) {
        visible.push(to);
        continue;
      }
      const los = resolveBattlefieldLineOfSight({
        from,
        to,
        battlefield: map,
        observerAltitudeFeet: observer?.flightState?.altitudeFeet ?? observer?.altitudeFeet ?? observer?.altitude ?? 0,
        targetAltitudeFeet: 0,
      });
      if (los.hasLineOfSight) visible.push(to);
    }
  }
  return visible;
}

function mergeCells(...collections) {
  const merged = new Map();
  for (const collection of collections) {
    for (const cell of Array.isArray(collection) ? collection : []) {
      if (!cell || !Number.isFinite(Number(cell.x)) || !Number.isFinite(Number(cell.y))) continue;
      merged.set(cellKey(cell.x, cell.y), { x: Number(cell.x), y: Number(cell.y) });
    }
  }
  return Array.from(merged.values());
}

function getTargetVisibleAtPosition(target, targetPosition, visibleLookup) {
  if (!targetPosition) return false;
  return visibleLookup.has(cellKey(targetPosition.x, targetPosition.y));
}

export function calculateBattlefieldTeamVisibility({
  team,
  fighters = [],
  positions = {},
  battlefield,
  previousState = null,
  round = 0,
} = {}) {
  const map = normalizeBattlefieldMap(battlefield?.battlefieldMap || battlefield || {});
  const normalizedTeam = normalizeText(team);
  const observers = fighters.filter((fighter) => (
    isCombatantAvailable(fighter) &&
    resolveBattlefieldFighterTeam(fighter) === normalizedTeam &&
    positions?.[fighter?.id || fighter?._id]
  ));
  const visibleCollections = observers.map((observer) => calculateBattlefieldVisibleCellsForObserver({
    observer,
    position: positions[observer.id || observer._id],
    battlefield: map,
  }));
  let visibleCells = mergeCells(...visibleCollections);
  const visibleLookup = new Set(visibleCells.map((cell) => cellKey(cell.x, cell.y)));
  const fogOfWar = map.environment?.fogOfWar || {};
  const exploredCells = fogOfWar.rememberExplored === false
    ? visibleCells
    : mergeCells(previousState?.exploredCells || [], visibleCells);
  const previousLastKnown = previousState?.lastKnownEnemies && typeof previousState.lastKnownEnemies === "object"
    ? previousState.lastKnownEnemies
    : {};
  const lastKnownEnemies = fogOfWar.rememberLastKnownEnemies === false ? {} : { ...previousLastKnown };
  const visibleEnemyIds = [];
  const hiddenEnemyIds = [];

  for (const target of fighters) {
    if (!isCombatantAvailable(target)) continue;
    const targetTeam = resolveBattlefieldFighterTeam(target);
    if (!targetTeam || targetTeam === normalizedTeam) continue;
    const targetId = target.id || target._id;
    const targetPosition = positions?.[targetId];
    if (!targetId || !targetPosition) continue;
    const targetVisible = getTargetVisibleAtPosition(target, targetPosition, visibleLookup) || observers.some((observer) => (
      resolveActorVisibility({ observer, target, positions, battlefield: map }).visible
    ));
    if (targetVisible) {
      visibleEnemyIds.push(targetId);
      const targetCellKey = cellKey(targetPosition.x, targetPosition.y);
      if (!visibleLookup.has(targetCellKey)) {
        visibleLookup.add(targetCellKey);
        visibleCells = mergeCells(visibleCells, [{ x: Number(targetPosition.x), y: Number(targetPosition.y) }]);
      }
      if (fogOfWar.rememberLastKnownEnemies !== false) {
        lastKnownEnemies[targetId] = {
          actorId: targetId,
          name: target.name || target.characterName || "Unknown",
          x: Number(targetPosition.x),
          y: Number(targetPosition.y),
          round: Number(round) || 0,
          seenByTeam: normalizedTeam,
          currentlyVisible: true,
        };
      }
    } else {
      hiddenEnemyIds.push(targetId);
      if (lastKnownEnemies[targetId]) lastKnownEnemies[targetId] = { ...lastKnownEnemies[targetId], currentlyVisible: false };
    }
  }

  return {
    team: normalizedTeam,
    visibleCells,
    exploredCells,
    visibleEnemyIds,
    hiddenEnemyIds,
    lastKnownEnemies,
    observerIds: observers.map((observer) => observer.id || observer._id).filter(Boolean),
    fogOfWarEnabled: map.environment?.fogOfWar?.enabled === true,
    environment: {
      lighting: map.environment?.lighting,
      environmentalFog: { ...(map.environment?.environmentalFog || {}) },
    },
    round: Number(round) || 0,
  };
}

export function calculateBattlefieldVisibilityByTeam({
  fighters = [],
  positions = {},
  battlefield,
  previousByTeam = {},
  round = 0,
} = {}) {
  const teams = new Set(
    fighters.map(resolveBattlefieldFighterTeam).filter(Boolean),
  );
  const byTeam = {};
  for (const team of teams) {
    byTeam[team] = calculateBattlefieldTeamVisibility({
      team,
      fighters,
      positions,
      battlefield,
      previousState: previousByTeam?.[team] || null,
      round,
    });
  }
  return { byTeam, teams: Array.from(teams), round: Number(round) || 0 };
}

export function getBattlefieldTeamVisibilityState(byTeam = {}, teamOrFighter = "party") {
  const team = typeof teamOrFighter === "string" ? normalizeText(teamOrFighter) : resolveBattlefieldFighterTeam(teamOrFighter);
  return byTeam?.[team] || null;
}

export function getEnvironmentalFogVisibilityLabel(battlefield) {
  const map = normalizeBattlefieldMap(battlefield?.battlefieldMap || battlefield || {});
  const fog = map.environment?.environmentalFog;
  if (!fog || fog.type === BATTLEFIELD_FOG.CLEAR) return "Clear";
  if (fog.type === BATTLEFIELD_FOG.MIST) return "Light mist";
  if (fog.type === BATTLEFIELD_FOG.FOG) return "Fog";
  return "Dense fog";
}

export default calculateBattlefieldVisibilityByTeam;
