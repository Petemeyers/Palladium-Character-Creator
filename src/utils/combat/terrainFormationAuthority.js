const normalizeText = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
const toFinite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const FORMATION_TERRAIN_TYPES = Object.freeze({
  OPEN: "open-ground",
  NARROW: "narrow-passage",
  FOREST: "forest",
  UNEVEN: "uneven-ground",
  MUD: "mud",
  RUBBLE: "rubble",
  ELEVATED: "elevated-ground",
  UNKNOWN: "unknown",
});

const TERRAIN_EFFECTS = Object.freeze({
  [FORMATION_TERRAIN_TYPES.OPEN]: Object.freeze({ cohesionModifier: 0, supportCapModifier: 0, movementStaminaModifier: 0, label: "Open ground" }),
  [FORMATION_TERRAIN_TYPES.NARROW]: Object.freeze({ cohesionModifier: 1, supportCapModifier: -1, movementStaminaModifier: 0, label: "Narrow passage" }),
  [FORMATION_TERRAIN_TYPES.FOREST]: Object.freeze({ cohesionModifier: -1, supportCapModifier: -1, movementStaminaModifier: 0, label: "Forest" }),
  [FORMATION_TERRAIN_TYPES.UNEVEN]: Object.freeze({ cohesionModifier: -1, supportCapModifier: 0, movementStaminaModifier: 0, label: "Uneven ground" }),
  [FORMATION_TERRAIN_TYPES.MUD]: Object.freeze({ cohesionModifier: -1, supportCapModifier: 0, movementStaminaModifier: 1, label: "Mud" }),
  [FORMATION_TERRAIN_TYPES.RUBBLE]: Object.freeze({ cohesionModifier: -2, supportCapModifier: -1, movementStaminaModifier: 1, label: "Rubble" }),
  [FORMATION_TERRAIN_TYPES.ELEVATED]: Object.freeze({ cohesionModifier: 1, supportCapModifier: 0, movementStaminaModifier: 0, label: "Elevated ground" }),
  [FORMATION_TERRAIN_TYPES.UNKNOWN]: Object.freeze({ cohesionModifier: 0, supportCapModifier: 0, movementStaminaModifier: 0, label: "Unknown terrain" }),
});

export const normalizeFormationTerrainType = (terrain = null) => {
  const text = normalizeText(
    typeof terrain === "string"
      ? terrain
      : terrain?.formationType || terrain?.terrainType || terrain?.terrain || terrain?.type || terrain?.name || terrain?.id,
  );
  if (!text) return FORMATION_TERRAIN_TYPES.OPEN;
  if (/narrow|corridor|passage|bridge|gate|doorway/.test(text)) return FORMATION_TERRAIN_TYPES.NARROW;
  if (/forest|woods|woodland|trees|brush|thicket/.test(text)) return FORMATION_TERRAIN_TYPES.FOREST;
  if (/uneven|slope|hill|rough-ground/.test(text)) return FORMATION_TERRAIN_TYPES.UNEVEN;
  if (/mud|marsh|bog|swamp/.test(text)) return FORMATION_TERRAIN_TYPES.MUD;
  if (/rubble|ruin|debris|broken-ground/.test(text)) return FORMATION_TERRAIN_TYPES.RUBBLE;
  if (/elevated|high-ground|ridge|rampart|wall-top/.test(text)) return FORMATION_TERRAIN_TYPES.ELEVATED;
  if (/open|plain|field|grass|arena|road/.test(text)) return FORMATION_TERRAIN_TYPES.OPEN;
  return FORMATION_TERRAIN_TYPES.UNKNOWN;
};

const facingToRadians = (facing) => {
  const numeric = Number(facing);
  if (!Number.isFinite(numeric)) return 0;
  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 5) return numeric * (Math.PI / 3);
  return numeric * (Math.PI / 180);
};

const normalizeAngle = (angle) => {
  let next = angle;
  while (next > Math.PI) next -= Math.PI * 2;
  while (next < -Math.PI) next += Math.PI * 2;
  return next;
};

export const resolveFormationFacingPressure = ({ actorPosition, targetPosition, actorFacing = null } = {}) => {
  if (!actorPosition || !targetPosition) {
    return { arc: "unknown", flanked: false, rearPressure: false, angleDegrees: null, supportModifier: 0 };
  }
  const dx = toFinite(targetPosition.x) - toFinite(actorPosition.x);
  const dy = toFinite(targetPosition.y) - toFinite(actorPosition.y);
  if (dx === 0 && dy === 0) {
    return { arc: "front", flanked: false, rearPressure: false, angleDegrees: 0, supportModifier: 0 };
  }
  const targetAngle = Math.atan2(dy, dx);
  const facingAngle = facingToRadians(actorFacing ?? actorPosition.facing ?? 0);
  const delta = Math.abs(normalizeAngle(targetAngle - facingAngle));
  const degrees = delta * 180 / Math.PI;
  if (degrees <= 60) return { arc: "front", flanked: false, rearPressure: false, angleDegrees: degrees, supportModifier: 0 };
  if (degrees <= 125) return { arc: "flank", flanked: true, rearPressure: false, angleDegrees: degrees, supportModifier: -1 };
  return { arc: "rear", flanked: true, rearPressure: true, angleDegrees: degrees, supportModifier: -2 };
};

export const resolveTerrainFormationContext = ({
  actor = null,
  target = null,
  actorPosition = null,
  targetPosition = null,
  terrain = null,
  targetTerrain = null,
} = {}) => {
  const terrainType = normalizeFormationTerrainType(terrain);
  const effect = TERRAIN_EFFECTS[terrainType] || TERRAIN_EFFECTS[FORMATION_TERRAIN_TYPES.UNKNOWN];
  const facing = resolveFormationFacingPressure({
    actorPosition,
    targetPosition,
    actorFacing: actor?.facing ?? actorPosition?.facing,
  });
  const targetTerrainType = normalizeFormationTerrainType(targetTerrain);
  const elevatedAgainstLower = terrainType === FORMATION_TERRAIN_TYPES.ELEVATED && targetTerrainType !== FORMATION_TERRAIN_TYPES.ELEVATED;
  const uphillPenalty = targetTerrainType === FORMATION_TERRAIN_TYPES.ELEVATED && terrainType !== FORMATION_TERRAIN_TYPES.ELEVATED;
  const elevationModifier = elevatedAgainstLower ? 1 : uphillPenalty ? -1 : 0;
  const cohesionModifier = Math.max(-3, Math.min(2, effect.cohesionModifier + facing.supportModifier + elevationModifier));
  return {
    terrainType,
    terrainLabel: effect.label,
    targetTerrainType,
    facingArc: facing.arc,
    flanked: facing.flanked,
    rearPressure: facing.rearPressure,
    angleDegrees: facing.angleDegrees,
    cohesionModifier,
    supportCapModifier: effect.supportCapModifier + (facing.rearPressure ? -1 : 0),
    movementStaminaModifier: effect.movementStaminaModifier,
    elevatedAgainstLower,
    uphillPenalty,
    actorId: actor?.id || actor?._id || null,
    targetId: target?.id || target?._id || null,
    reasons: [effect.label, facing.arc, elevatedAgainstLower ? "high-ground" : uphillPenalty ? "uphill-pressure" : null].filter(Boolean),
  };
};

export const getFormationTerrainEffect = (terrain) => {
  const terrainType = normalizeFormationTerrainType(terrain);
  return { terrainType, ...(TERRAIN_EFFECTS[terrainType] || TERRAIN_EFFECTS[FORMATION_TERRAIN_TYPES.UNKNOWN]) };
};
