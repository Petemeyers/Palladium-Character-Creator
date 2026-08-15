import {
  getBridgeDeckLayersAt,
} from "./bridgeLayerAuthority.js";

export const WATER_ENVIRONMENT_VERSION = 1;
export const DEFAULT_WATER_DEPTH_FEET = 3;
export const DEFAULT_ACTOR_HEIGHT_FEET = 5.75;

export const WATER_DEPTH_BANDS = Object.freeze({
  DRY: "dry",
  ANKLE: "ankle",
  SHIN: "shin",
  KNEE: "knee",
  WAIST: "waist",
  CHEST: "chest",
  SWIMMING: "swimming",
  DEEP: "deep",
});

export const WATER_CURRENT_STRENGTHS = Object.freeze({
  NONE: "none",
  LIGHT: "light",
  MODERATE: "moderate",
  STRONG: "strong",
  RAPID: "rapid",
  TORRENT: "torrent",
});

export const WATER_BOTTOM_TERRAINS = Object.freeze({
  ROCK: "rock",
  GRAVEL: "gravel",
  SAND: "sand",
  MUD: "mud",
  RUBBLE: "rubble",
  UNKNOWN: "unknown",
});

export const WATER_TRAVERSAL_REASONS = Object.freeze({
  SWIM_REQUIRED: "swim-required",
  FAST_MODE_BLOCKED: "water-too-deep-for-fast-movement",
  CHARGE_BLOCKED: "charge-blocked-by-water",
  INVALID_LAYER: "invalid-water-traversal-layer",
  VERTICAL_LAYER_ACCESS: "vertical-layer-access-required",
});

const finite = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

const clamp = (value, min, max) =>
  Math.max(min, Math.min(max, value));

const normalizeText = (value) =>
  String(value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");

const CURRENT_DIRECTION_VECTORS = Object.freeze({
  N: Object.freeze({ dx: 0, dy: -1 }),
  NE: Object.freeze({ dx: 1, dy: -1 }),
  E: Object.freeze({ dx: 1, dy: 0 }),
  SE: Object.freeze({ dx: 1, dy: 1 }),
  S: Object.freeze({ dx: 0, dy: 1 }),
  SW: Object.freeze({ dx: -1, dy: 1 }),
  W: Object.freeze({ dx: -1, dy: 0 }),
  NW: Object.freeze({ dx: -1, dy: -1 }),
});

export const WATER_DEPTH_MOVEMENT_PROFILES = Object.freeze({
  [WATER_DEPTH_BANDS.DRY]: Object.freeze({
    distanceMultiplier: 1,
    staminaCost: 0,
    blocksCharge: false,
    requiresWalk: false,
    requiresSwim: false,
  }),
  [WATER_DEPTH_BANDS.ANKLE]: Object.freeze({
    distanceMultiplier: 1,
    staminaCost: 0,
    blocksCharge: false,
    requiresWalk: false,
    requiresSwim: false,
  }),
  [WATER_DEPTH_BANDS.SHIN]: Object.freeze({
    distanceMultiplier: 1.1,
    staminaCost: 0,
    blocksCharge: true,
    requiresWalk: false,
    requiresSwim: false,
  }),
  [WATER_DEPTH_BANDS.KNEE]: Object.freeze({
    distanceMultiplier: 1.25,
    staminaCost: 1,
    blocksCharge: true,
    requiresWalk: true,
    requiresSwim: false,
  }),
  [WATER_DEPTH_BANDS.WAIST]: Object.freeze({
    distanceMultiplier: 1.5,
    staminaCost: 1,
    blocksCharge: true,
    requiresWalk: true,
    requiresSwim: false,
  }),
  [WATER_DEPTH_BANDS.CHEST]: Object.freeze({
    distanceMultiplier: 1.8,
    staminaCost: 2,
    blocksCharge: true,
    requiresWalk: true,
    requiresSwim: false,
  }),
  [WATER_DEPTH_BANDS.SWIMMING]: Object.freeze({
    distanceMultiplier: 2,
    staminaCost: 2,
    blocksCharge: true,
    requiresWalk: false,
    requiresSwim: true,
  }),
  [WATER_DEPTH_BANDS.DEEP]: Object.freeze({
    distanceMultiplier: 2.25,
    staminaCost: 3,
    blocksCharge: true,
    requiresWalk: false,
    requiresSwim: true,
  }),
});

export const WATER_CURRENT_PROFILES = Object.freeze({
  [WATER_CURRENT_STRENGTHS.NONE]: Object.freeze({
    resistanceFeet: 0,
    staminaCost: 0,
    driftCells: 0,
    controlPressure: 0,
  }),
  [WATER_CURRENT_STRENGTHS.LIGHT]: Object.freeze({
    resistanceFeet: 0,
    staminaCost: 0,
    driftCells: 0.1,
    controlPressure: 0.1,
  }),
  [WATER_CURRENT_STRENGTHS.MODERATE]: Object.freeze({
    resistanceFeet: 0.5,
    staminaCost: 0,
    driftCells: 0.25,
    controlPressure: 0.25,
  }),
  [WATER_CURRENT_STRENGTHS.STRONG]: Object.freeze({
    resistanceFeet: 1,
    staminaCost: 1,
    driftCells: 0.5,
    controlPressure: 0.5,
  }),
  [WATER_CURRENT_STRENGTHS.RAPID]: Object.freeze({
    resistanceFeet: 2,
    staminaCost: 1,
    driftCells: 1,
    controlPressure: 0.75,
  }),
  [WATER_CURRENT_STRENGTHS.TORRENT]: Object.freeze({
    resistanceFeet: 3,
    staminaCost: 2,
    driftCells: 2,
    controlPressure: 1,
  }),
});

const BOTTOM_PROFILES = Object.freeze({
  [WATER_BOTTOM_TERRAINS.ROCK]: Object.freeze({
    extraDistanceFeet: 0,
    staminaCost: 0,
    traction: "firm",
  }),
  [WATER_BOTTOM_TERRAINS.GRAVEL]: Object.freeze({
    extraDistanceFeet: 0.25,
    staminaCost: 0,
    traction: "loose",
  }),
  [WATER_BOTTOM_TERRAINS.SAND]: Object.freeze({
    extraDistanceFeet: 0.5,
    staminaCost: 0,
    traction: "soft",
  }),
  [WATER_BOTTOM_TERRAINS.MUD]: Object.freeze({
    extraDistanceFeet: 1,
    staminaCost: 1,
    traction: "poor",
  }),
  [WATER_BOTTOM_TERRAINS.RUBBLE]: Object.freeze({
    extraDistanceFeet: 1,
    staminaCost: 1,
    traction: "uneven",
  }),
  [WATER_BOTTOM_TERRAINS.UNKNOWN]: Object.freeze({
    extraDistanceFeet: 0.25,
    staminaCost: 0,
    traction: "unknown",
  }),
});

const ARMOR_WATER_BURDEN = Object.freeze({
  none: Object.freeze({ distanceFactor: 0, stamina: 0 }),
  light: Object.freeze({ distanceFactor: 0.04, stamina: 0 }),
  moderate: Object.freeze({ distanceFactor: 0.1, stamina: 0 }),
  heavy: Object.freeze({ distanceFactor: 0.18, stamina: 1 }),
  severe: Object.freeze({ distanceFactor: 0.3, stamina: 2 }),
});

function isWaterTerrain(cell = {}) {
  const key = normalizeText(
    cell.terrainType ??
    cell.terrain ??
    cell.visualTerrain ??
    cell.type
  );
  return key === "water" || key.includes("water") || key.includes("river");
}

function getCellElevationUnits(cell = {}) {
  return finite(
    cell.height ??
    cell.elevation ??
    cell.elev,
    0
  );
}

export function inferWaterDepthFeet(cell = {}) {
  const explicit = Number(
    cell.waterDepthFeet ??
    cell.water?.depthFeet ??
    cell.waterEnvironment?.depthFeet
  );
  if (Number.isFinite(explicit) && explicit >= 0) {
    return explicit;
  }

  if (!isWaterTerrain(cell)) return 0;

  const elevation = getCellElevationUnits(cell);
  if (elevation < 0) {
    return Math.max(
      DEFAULT_WATER_DEPTH_FEET,
      Math.abs(elevation) * 2.5
    );
  }

  return DEFAULT_WATER_DEPTH_FEET;
}

export function normalizeWaterCurrent(value = {}) {
  const source =
    typeof value === "string"
      ? { strength: value }
      : value || {};

  const strengthKey = normalizeText(
    source.strength ??
    source.currentStrength ??
    source.type ??
    WATER_CURRENT_STRENGTHS.NONE
  );

  const strength = Object.values(WATER_CURRENT_STRENGTHS).includes(strengthKey)
    ? strengthKey
    : WATER_CURRENT_STRENGTHS.NONE;

  const directionRaw = String(
    source.direction ??
    source.flowDirection ??
    ""
  ).trim().toUpperCase();

  const direction = CURRENT_DIRECTION_VECTORS[directionRaw]
    ? directionRaw
    : null;

  return {
    strength,
    direction,
  };
}

export function normalizeWaterBottomTerrain(value) {
  const key = normalizeText(value || WATER_BOTTOM_TERRAINS.UNKNOWN);
  return Object.values(WATER_BOTTOM_TERRAINS).includes(key)
    ? key
    : WATER_BOTTOM_TERRAINS.UNKNOWN;
}

export function normalizeWaterActorProfile(profile = {}) {
  const heightFeet = clamp(
    finite(profile.heightFeet ?? profile.actorHeightFeet, DEFAULT_ACTOR_HEIGHT_FEET),
    2,
    15
  );

  const armorBurdenRaw = normalizeText(
    profile.armorWaterBurden ??
    profile.armorBurden ??
    "none"
  );
  const armorWaterBurden = ARMOR_WATER_BURDEN[armorBurdenRaw]
    ? armorBurdenRaw
    : "none";

  return {
    heightFeet,
    swimThresholdFraction: clamp(
      finite(profile.swimThresholdFraction, 0.72),
      0.55,
      0.9
    ),
    deepWaterFraction: clamp(
      finite(profile.deepWaterFraction, 1.1),
      0.9,
      2
    ),
    armorWaterBurden,
    carriedLoadFraction: clamp(
      finite(profile.carriedLoadFraction, 0),
      0,
      2
    ),
    buoyancyAssist: clamp(
      finite(profile.buoyancyAssist, 0),
      0,
      1
    ),
    currentControl: clamp(
      finite(profile.currentControl, 0),
      0,
      1
    ),
    anchored: profile.anchored === true,
    holdingSafetyLine: profile.holdingSafetyLine === true,
  };
}

export function getWaterDepthBand(depthFeet, actorProfile = {}) {
  const profile = normalizeWaterActorProfile(actorProfile);
  const depth = Math.max(0, finite(depthFeet, 0));
  const fraction = profile.heightFeet > 0
    ? depth / profile.heightFeet
    : 0;

  if (depth <= 0.01) return WATER_DEPTH_BANDS.DRY;
  if (fraction <= 0.08) return WATER_DEPTH_BANDS.ANKLE;
  if (fraction <= 0.18) return WATER_DEPTH_BANDS.SHIN;
  if (fraction <= 0.30) return WATER_DEPTH_BANDS.KNEE;
  if (fraction <= 0.50) return WATER_DEPTH_BANDS.WAIST;
  if (fraction <= profile.swimThresholdFraction) {
    return WATER_DEPTH_BANDS.CHEST;
  }
  if (fraction <= profile.deepWaterFraction) {
    return WATER_DEPTH_BANDS.SWIMMING;
  }
  return WATER_DEPTH_BANDS.DEEP;
}

export function getWaterEnvironmentFromCell(cell = {}, actorProfile = {}) {
  const depthFeet = Math.max(0, inferWaterDepthFeet(cell));
  const water = isWaterTerrain(cell) || depthFeet > 0.01;
  const current = normalizeWaterCurrent(
    cell.waterCurrent ??
    cell.waterEnvironment?.current ??
    {
      strength:
        cell.waterCurrentStrength ??
        cell.currentStrength,
      direction:
        cell.waterCurrentDirection ??
        cell.flowDirection,
    }
  );

  const bottomTerrain = normalizeWaterBottomTerrain(
    cell.waterBottomTerrain ??
    cell.bottomTerrain ??
    cell.waterEnvironment?.bottomTerrain
  );

  const temperatureRaw = Number(
    cell.waterTemperatureF ??
    cell.water?.temperatureF ??
    cell.waterEnvironment?.temperatureF
  );

  const depthBand = water
    ? getWaterDepthBand(depthFeet, actorProfile)
    : WATER_DEPTH_BANDS.DRY;

  return {
    version: WATER_ENVIRONMENT_VERSION,
    isWater: water,
    depthFeet: water ? depthFeet : 0,
    depthBand,
    current,
    bottomTerrain,
    temperatureF: Number.isFinite(temperatureRaw)
      ? temperatureRaw
      : null,
    clarity: normalizeText(
      cell.waterClarity ??
      cell.waterEnvironment?.clarity ??
      "unknown"
    ),
    salinity: normalizeText(
      cell.waterSalinity ??
      cell.waterEnvironment?.salinity ??
      "fresh"
    ),
  };
}

export function applyWaterEnvironmentToCell(cell = {}, patch = {}) {
  const current = normalizeWaterCurrent(
    patch.waterCurrent ??
    patch.current ??
    {
      strength:
        patch.waterCurrentStrength ??
        patch.currentStrength ??
        cell.waterCurrent?.strength,
      direction:
        patch.waterCurrentDirection ??
        patch.flowDirection ??
        cell.waterCurrent?.direction,
    }
  );

  const depthFeet = Math.max(
    0,
    finite(
      patch.waterDepthFeet ??
      patch.depthFeet ??
      cell.waterDepthFeet,
      inferWaterDepthFeet(cell)
    )
  );

  const bottomTerrain = normalizeWaterBottomTerrain(
    patch.waterBottomTerrain ??
    patch.bottomTerrain ??
    cell.waterBottomTerrain
  );

  const temperatureCandidate =
    patch.waterTemperatureF ??
    patch.temperatureF ??
    cell.waterTemperatureF;

  const temperatureF = Number.isFinite(Number(temperatureCandidate))
    ? Number(temperatureCandidate)
    : null;

  return {
    ...cell,
    terrain: "water",
    terrainType: "water",
    waterDepthFeet: depthFeet,
    waterCurrent: current,
    waterBottomTerrain: bottomTerrain,
    ...(temperatureF == null ? {} : { waterTemperatureF: temperatureF }),
    waterEnvironmentVersion: WATER_ENVIRONMENT_VERSION,
  };
}

export function createWaterPaintPatch(config = {}) {
  return applyWaterEnvironmentToCell(
    {
      terrain: "water",
      terrainType: "water",
    },
    config
  );
}

export function getWaterTraversalSurfacesAt(
  mapDefinition,
  position,
  actorProfile = {}
) {
  const x = Number(position?.x ?? position?.q);
  const y = Number(position?.y ?? position?.r);
  const cell = mapDefinition?.grid?.[y]?.[x] || null;
  if (!cell) return [];

  const water = getWaterEnvironmentFromCell(cell, actorProfile);
  const lower = {
    id: `lower:${x},${y}`,
    type: water.isWater ? "water" : "ground",
    layer: "lower",
    x,
    y,
    water,
    terrain: cell.terrain || cell.terrainType || "grass",
    surfaceElevationFeet: getCellElevationUnits(cell) * 2.5,
  };

  const bridgeDecks = getBridgeDeckLayersAt(mapDefinition, x, y).map(
    (layer) => ({
      ...layer,
      type: "bridge-deck",
      layer: "bridge-deck",
      x,
      y,
      waterBelow: water.isWater,
      lowerLayerPreserved: true,
    })
  );

  return [lower, ...bridgeDecks];
}

export function resolveWaterTraversalSurfaceAt({
  mapDefinition,
  position,
  layer = "lower",
  actorProfile = {},
} = {}) {
  const surfaces = getWaterTraversalSurfacesAt(
    mapDefinition,
    position,
    actorProfile
  );

  if (!surfaces.length) return null;

  const normalizedLayer = normalizeText(layer || "lower");
  if (["bridge", "bridge-deck", "deck"].includes(normalizedLayer)) {
    return surfaces.find((surface) => surface.type === "bridge-deck") || null;
  }

  return surfaces.find((surface) => surface.layer === "lower") || surfaces[0];
}

function isFlightMode(mode) {
  return /(^|-)fly|flight|airborne/.test(normalizeText(mode));
}

function isSwimMode(mode) {
  return /(^|-)swim|swimming/.test(normalizeText(mode));
}

function isFastGroundMode(mode) {
  return /run|sprint|dash/.test(normalizeText(mode));
}

function isChargeMode(mode) {
  return /charge/.test(normalizeText(mode));
}

function directionVector(direction) {
  return CURRENT_DIRECTION_VECTORS[
    String(direction || "").trim().toUpperCase()
  ] || null;
}

function normalizedDot(a, b) {
  if (!a || !b) return 0;
  const aLength = Math.hypot(a.dx, a.dy);
  const bLength = Math.hypot(b.dx, b.dy);
  if (aLength <= 0 || bLength <= 0) return 0;
  return (
    (a.dx * b.dx + a.dy * b.dy) /
    (aLength * bLength)
  );
}

export function getWaterCurrentMovementRelation({
  from,
  to,
  currentDirection,
} = {}) {
  const currentVector = directionVector(currentDirection);
  if (!currentVector || !from || !to) {
    return {
      relation: "none",
      dot: 0,
      resistanceFactor: 1,
    };
  }

  const movementVector = {
    dx: Number(to.x) - Number(from.x),
    dy: Number(to.y) - Number(from.y),
  };
  const dot = normalizedDot(movementVector, currentVector);

  if (dot >= 0.5) {
    return {
      relation: "downstream",
      dot,
      resistanceFactor: 0.6,
    };
  }
  if (dot <= -0.5) {
    return {
      relation: "upstream",
      dot,
      resistanceFactor: 1.5,
    };
  }
  return {
    relation: "cross-current",
    dot,
    resistanceFactor: 1,
  };
}

function depthRank(band) {
  const order = [
    WATER_DEPTH_BANDS.DRY,
    WATER_DEPTH_BANDS.ANKLE,
    WATER_DEPTH_BANDS.SHIN,
    WATER_DEPTH_BANDS.KNEE,
    WATER_DEPTH_BANDS.WAIST,
    WATER_DEPTH_BANDS.CHEST,
    WATER_DEPTH_BANDS.SWIMMING,
    WATER_DEPTH_BANDS.DEEP,
  ];
  return Math.max(0, order.indexOf(band));
}

function chooseDominantWaterEnvironment(left, right) {
  if (!left?.isWater && !right?.isWater) {
    return left || right || {
      isWater: false,
      depthFeet: 0,
      depthBand: WATER_DEPTH_BANDS.DRY,
      current: normalizeWaterCurrent(),
      bottomTerrain: WATER_BOTTOM_TERRAINS.UNKNOWN,
    };
  }
  if (!left?.isWater) return right;
  if (!right?.isWater) return left;

  const leftRank = depthRank(left.depthBand);
  const rightRank = depthRank(right.depthBand);

  if (rightRank > leftRank) return right;
  if (leftRank > rightRank) return left;

  return right.depthFeet >= left.depthFeet ? right : left;
}

export function resolveWaterLayerTransition({
  mapDefinition,
  position,
  fromLayer = "lower",
  toLayer = "lower",
  accessAuthorized = false,
} = {}) {
  const from = normalizeText(fromLayer);
  const to = normalizeText(toLayer);

  if (from === to) {
    return {
      accepted: true,
      requiresVerticalAccess: false,
      fromLayer: from,
      toLayer: to,
    };
  }

  const surfaces = getWaterTraversalSurfacesAt(
    mapDefinition,
    position
  );
  const hasDeck = surfaces.some((surface) => surface.type === "bridge-deck");

  if (!hasDeck) {
    return {
      accepted: false,
      reason: WATER_TRAVERSAL_REASONS.INVALID_LAYER,
      requiresVerticalAccess: false,
      fromLayer: from,
      toLayer: to,
    };
  }

  const bridgeTransition =
    ["lower", "ground", "water"].includes(from) &&
    ["bridge", "bridge-deck", "deck"].includes(to) ||
    ["bridge", "bridge-deck", "deck"].includes(from) &&
    ["lower", "ground", "water"].includes(to);

  if (!bridgeTransition) {
    return {
      accepted: false,
      reason: WATER_TRAVERSAL_REASONS.INVALID_LAYER,
      requiresVerticalAccess: false,
      fromLayer: from,
      toLayer: to,
    };
  }

  return {
    accepted: accessAuthorized === true,
    reason:
      accessAuthorized === true
        ? null
        : WATER_TRAVERSAL_REASONS.VERTICAL_LAYER_ACCESS,
    requiresVerticalAccess: true,
    fromLayer: from,
    toLayer: to,
  };
}

export function resolveBattlefieldWaterTraversalStep({
  mapDefinition = null,
  from = null,
  to = null,
  movementMode = "walk",
  swimAuthorized = false,
  actorProfile = {},
  fromLayer = "lower",
  toLayer = "lower",
  baseDistanceFeet = 5,
} = {}) {
  const mode = normalizeText(movementMode || "walk");
  const profile = normalizeWaterActorProfile(actorProfile);
  const flight = isFlightMode(mode);

  const fromSurface = resolveWaterTraversalSurfaceAt({
    mapDefinition,
    position: from,
    layer: fromLayer,
    actorProfile: profile,
  });
  const toSurface = resolveWaterTraversalSurfaceAt({
    mapDefinition,
    position: to,
    layer: toLayer,
    actorProfile: profile,
  });

  const deckTraversal =
    fromSurface?.type === "bridge-deck" ||
    toSurface?.type === "bridge-deck";

  if (flight || deckTraversal) {
    return {
      accepted: true,
      reason: null,
      isWaterTraversal: false,
      surfaceType: flight ? "air" : "bridge-deck",
      extraDistanceFeet: 0,
      staminaCost: 0,
      requiresWalk: false,
      requiresSwim: false,
      blocksCharge: false,
      enteredWater: false,
      exitedWater: false,
      immersionFraction: 0,
      currentDrift: null,
    };
  }

  const fromWater = fromSurface?.water ||
    getWaterEnvironmentFromCell(
      mapDefinition?.grid?.[Number(from?.y)]?.[Number(from?.x)] || {},
      profile
    );
  const toWater = toSurface?.water ||
    getWaterEnvironmentFromCell(
      mapDefinition?.grid?.[Number(to?.y)]?.[Number(to?.x)] || {},
      profile
    );

  const dominant = chooseDominantWaterEnvironment(
    fromWater,
    toWater
  );

  if (!dominant?.isWater) {
    return {
      accepted: true,
      reason: null,
      isWaterTraversal: false,
      surfaceType: "ground",
      extraDistanceFeet: 0,
      staminaCost: 0,
      requiresWalk: false,
      requiresSwim: false,
      blocksCharge: false,
      enteredWater: false,
      exitedWater: false,
      immersionFraction: 0,
      currentDrift: null,
    };
  }

  const depthProfile =
    WATER_DEPTH_MOVEMENT_PROFILES[
      dominant.depthBand
    ] || WATER_DEPTH_MOVEMENT_PROFILES[WATER_DEPTH_BANDS.DRY];

  const requiresSwim = depthProfile.requiresSwim === true;
  const canSwim =
    swimAuthorized === true ||
    isSwimMode(mode);

  if (requiresSwim && !canSwim) {
    return {
      accepted: false,
      reason: WATER_TRAVERSAL_REASONS.SWIM_REQUIRED,
      isWaterTraversal: true,
      requiresSwim: true,
      requiresWalk: false,
      blocksCharge: true,
      depthFeet: dominant.depthFeet,
      depthBand: dominant.depthBand,
      actorHeightFeet: profile.heightFeet,
      immersionFraction: clamp(
        dominant.depthFeet / profile.heightFeet,
        0,
        2
      ),
      water: dominant,
    };
  }

  const fastModeBlocked =
    depthProfile.requiresWalk &&
    isFastGroundMode(mode);

  if (fastModeBlocked) {
    return {
      accepted: false,
      reason: WATER_TRAVERSAL_REASONS.FAST_MODE_BLOCKED,
      isWaterTraversal: true,
      requiresSwim,
      requiresWalk: true,
      blocksCharge: true,
      depthFeet: dominant.depthFeet,
      depthBand: dominant.depthBand,
      actorHeightFeet: profile.heightFeet,
      immersionFraction: clamp(
        dominant.depthFeet / profile.heightFeet,
        0,
        2
      ),
      water: dominant,
    };
  }

  if (depthProfile.blocksCharge && isChargeMode(mode)) {
    return {
      accepted: false,
      reason: WATER_TRAVERSAL_REASONS.CHARGE_BLOCKED,
      isWaterTraversal: true,
      requiresSwim,
      requiresWalk: depthProfile.requiresWalk === true,
      blocksCharge: true,
      depthFeet: dominant.depthFeet,
      depthBand: dominant.depthBand,
      actorHeightFeet: profile.heightFeet,
      immersionFraction: clamp(
        dominant.depthFeet / profile.heightFeet,
        0,
        2
      ),
      water: dominant,
    };
  }

  const base = Math.max(1, finite(baseDistanceFeet, 5));
  const depthExtraDistanceFeet =
    base * Math.max(
      0,
      depthProfile.distanceMultiplier - 1
    );

  const currentProfile =
    WATER_CURRENT_PROFILES[
      dominant.current?.strength
    ] || WATER_CURRENT_PROFILES[WATER_CURRENT_STRENGTHS.NONE];

  const currentRelation = getWaterCurrentMovementRelation({
    from,
    to,
    currentDirection: dominant.current?.direction,
  });

  const currentResistanceFeet =
    currentProfile.resistanceFeet *
    currentRelation.resistanceFactor;

  const bottomProfile =
    BOTTOM_PROFILES[dominant.bottomTerrain] ||
    BOTTOM_PROFILES[WATER_BOTTOM_TERRAINS.UNKNOWN];

  const wading = !requiresSwim;
  const bottomExtraDistanceFeet =
    wading
      ? bottomProfile.extraDistanceFeet
      : 0;

  const immersionFraction = clamp(
    dominant.depthFeet / profile.heightFeet,
    0,
    2
  );

  const burdenProfile =
    ARMOR_WATER_BURDEN[profile.armorWaterBurden] ||
    ARMOR_WATER_BURDEN.none;

  const loadFactor =
    clamp(profile.carriedLoadFraction, 0, 2) *
    0.08;

  const burdenExtraDistanceFeet =
    base *
    Math.min(1.5, immersionFraction) *
    (burdenProfile.distanceFactor + loadFactor) *
    (requiresSwim
      ? Math.max(0.25, 1 - profile.buoyancyAssist * 0.5)
      : 1);

  const burdenStamina =
    immersionFraction >= 0.5
      ? burdenProfile.stamina +
        (profile.carriedLoadFraction >= 0.75 ? 1 : 0)
      : 0;

  const currentDrift = projectWaterCurrentDrift({
    mapDefinition,
    position: to,
    actorProfile: profile,
  });

  return {
    accepted: true,
    reason: null,
    isWaterTraversal: true,
    surfaceType: "water",
    depthFeet: dominant.depthFeet,
    depthBand: dominant.depthBand,
    actorHeightFeet: profile.heightFeet,
    immersionFraction,
    enteredWater:
      !fromWater?.isWater &&
      toWater?.isWater === true,
    exitedWater:
      fromWater?.isWater === true &&
      !toWater?.isWater,
    depthIncreased:
      finite(toWater?.depthFeet, 0) >
      finite(fromWater?.depthFeet, 0) + 0.01,
    depthDecreased:
      finite(toWater?.depthFeet, 0) + 0.01 <
      finite(fromWater?.depthFeet, 0),
    currentStrength: dominant.current?.strength ||
      WATER_CURRENT_STRENGTHS.NONE,
    currentDirection: dominant.current?.direction || null,
    currentRelation,
    bottomTerrain: dominant.bottomTerrain,
    bottomTraction: bottomProfile.traction,
    temperatureF: dominant.temperatureF,
    requiresSwim,
    requiresWalk: depthProfile.requiresWalk === true,
    blocksCharge: depthProfile.blocksCharge === true,
    extraDistanceFeet:
      depthExtraDistanceFeet +
      currentResistanceFeet +
      bottomExtraDistanceFeet +
      burdenExtraDistanceFeet,
    staminaCost:
      depthProfile.staminaCost +
      currentProfile.staminaCost +
      (wading ? bottomProfile.staminaCost : 0) +
      burdenStamina,
    water: dominant,
    currentDrift,
  };
}

export function projectWaterCurrentDrift({
  mapDefinition = null,
  position = null,
  actorProfile = {},
  currentOverride = null,
} = {}) {
  const profile = normalizeWaterActorProfile(actorProfile);
  const x = Number(position?.x ?? position?.q);
  const y = Number(position?.y ?? position?.r);

  const cell =
    mapDefinition?.grid?.[y]?.[x] ||
    {};

  const water = getWaterEnvironmentFromCell(
    cell,
    profile
  );

  const current = currentOverride
    ? normalizeWaterCurrent(currentOverride)
    : water.current;

  const currentProfile =
    WATER_CURRENT_PROFILES[
      current.strength
    ] || WATER_CURRENT_PROFILES[WATER_CURRENT_STRENGTHS.NONE];

  const vector = directionVector(current.direction);
  if (
    !water.isWater ||
    !vector ||
    currentProfile.driftCells <= 0
  ) {
    return {
      active: false,
      direction: current.direction || null,
      strength: current.strength,
      driftCells: 0,
      pressure: 0,
      vector: null,
    };
  }

  const safetyReduction =
    profile.anchored
      ? 1
      : profile.holdingSafetyLine
        ? 0.75
        : 0;

  const controlReduction =
    clamp(
      Math.max(
        safetyReduction,
        profile.currentControl * 0.7
      ),
      0,
      1
    );

  const buoyancyControl =
    profile.buoyancyAssist * 0.1;

  const effectiveReduction = clamp(
    controlReduction + buoyancyControl,
    0,
    1
  );

  const driftCells =
    currentProfile.driftCells *
    (1 - effectiveReduction);

  return {
    active: driftCells > 0.01,
    direction: current.direction,
    strength: current.strength,
    driftCells,
    pressure:
      currentProfile.controlPressure *
      (1 - effectiveReduction),
    vector: {
      dx: vector.dx,
      dy: vector.dy,
    },
    projectedOffset: {
      x: vector.dx * driftCells,
      y: vector.dy * driftCells,
    },
    safetyLineEffective:
      profile.holdingSafetyLine === true,
    anchored:
      profile.anchored === true,
  };
}


export function assessWaterTraversalRisk({
  cell = null,
  waterEnvironment = null,
  actorProfile = {},
  movementMode = "walk",
} = {}) {
  const profile = normalizeWaterActorProfile(actorProfile);
  const water = waterEnvironment ||
    getWaterEnvironmentFromCell(cell || {}, profile);

  if (!water?.isWater) {
    return {
      score: 0,
      category: "none",
      flags: [],
      water,
      actorProfile: profile,
    };
  }

  const flags = [];
  let score = 0;

  const bandScores = {
    [WATER_DEPTH_BANDS.ANKLE]: 2,
    [WATER_DEPTH_BANDS.SHIN]: 6,
    [WATER_DEPTH_BANDS.KNEE]: 12,
    [WATER_DEPTH_BANDS.WAIST]: 22,
    [WATER_DEPTH_BANDS.CHEST]: 35,
    [WATER_DEPTH_BANDS.SWIMMING]: 55,
    [WATER_DEPTH_BANDS.DEEP]: 68,
  };
  score += bandScores[water.depthBand] || 0;

  if ([
    WATER_DEPTH_BANDS.SWIMMING,
    WATER_DEPTH_BANDS.DEEP,
  ].includes(water.depthBand)) {
    flags.push("swimming-required");
  }

  const currentScores = {
    [WATER_CURRENT_STRENGTHS.NONE]: 0,
    [WATER_CURRENT_STRENGTHS.LIGHT]: 2,
    [WATER_CURRENT_STRENGTHS.MODERATE]: 8,
    [WATER_CURRENT_STRENGTHS.STRONG]: 18,
    [WATER_CURRENT_STRENGTHS.RAPID]: 30,
    [WATER_CURRENT_STRENGTHS.TORRENT]: 45,
  };
  score += currentScores[water.current?.strength] || 0;

  if ([
    WATER_CURRENT_STRENGTHS.STRONG,
    WATER_CURRENT_STRENGTHS.RAPID,
    WATER_CURRENT_STRENGTHS.TORRENT,
  ].includes(water.current?.strength)) {
    flags.push("dangerous-current");
  }

  const burdenScores = {
    none: 0,
    light: 2,
    moderate: 6,
    heavy: 14,
    severe: 24,
  };
  score += burdenScores[profile.armorWaterBurden] || 0;

  if (["heavy", "severe"].includes(profile.armorWaterBurden)) {
    flags.push("heavy-water-burden");
  }

  if (profile.carriedLoadFraction >= 0.5) {
    score += Math.min(18, profile.carriedLoadFraction * 12);
    flags.push("loaded-crossing");
  }

  if (profile.buoyancyAssist > 0) {
    score -= profile.buoyancyAssist * 10;
    flags.push("buoyancy-assist");
  }

  if (profile.holdingSafetyLine) {
    score -= 12;
    flags.push("safety-line");
  }

  if (profile.anchored) {
    score -= 15;
    flags.push("anchored");
  }

  if (
    /run|sprint|charge/.test(normalizeText(movementMode)) &&
    depthRank(water.depthBand) >= depthRank(WATER_DEPTH_BANDS.KNEE)
  ) {
    score += 8;
    flags.push("unsafe-fast-movement");
  }

  score = clamp(Math.round(score), 0, 100);

  const category =
    score >= 75 ? "severe" :
    score >= 50 ? "high" :
    score >= 25 ? "moderate" :
    score > 0 ? "low" :
    "none";

  return {
    score,
    category,
    flags: Array.from(new Set(flags)),
    water,
    actorProfile: profile,
  };
}

export function describeWaterTraversalFailure(reason) {
  switch (reason) {
    case WATER_TRAVERSAL_REASONS.SWIM_REQUIRED:
      return "the water is too deep to wade; swimming is required";
    case WATER_TRAVERSAL_REASONS.FAST_MODE_BLOCKED:
      return "the water is too deep for fast ground movement";
    case WATER_TRAVERSAL_REASONS.CHARGE_BLOCKED:
      return "the water is too deep to charge through";
    case WATER_TRAVERSAL_REASONS.VERTICAL_LAYER_ACCESS:
      return "changing between the lower water layer and bridge deck requires a vertical access action";
    case WATER_TRAVERSAL_REASONS.INVALID_LAYER:
      return "that water/bridge traversal layer is not available";
    default:
      return String(reason || "water blocks that movement");
  }
}

export default {
  WATER_CURRENT_STRENGTHS,
  WATER_DEPTH_BANDS,
  WATER_TRAVERSAL_REASONS,
  applyWaterEnvironmentToCell,
  assessWaterTraversalRisk,
  createWaterPaintPatch,
  describeWaterTraversalFailure,
  getWaterDepthBand,
  getWaterEnvironmentFromCell,
  getWaterTraversalSurfacesAt,
  normalizeWaterActorProfile,
  projectWaterCurrentDrift,
  resolveBattlefieldWaterTraversalStep,
  resolveWaterLayerTransition,
  resolveWaterTraversalSurfaceAt,
};
