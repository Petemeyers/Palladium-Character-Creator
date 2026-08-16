import {
  BATTLEFIELD_HEX_DIRECTIONS,
  BATTLEFIELD_SLOPE_TRANSITIONS,
  getBattlefieldCellTerrainKey,
  getBattlefieldDirectionBetween,
  getBattlefieldEdgeTransition,
  getBattlefieldMapCell,
  getBattlefieldNeighborOffset,
  resolveBattlefieldSlopeTraversal,
} from "../maps/battlefieldSlopeAuthority.js";

export const CANONICAL_CLIMB_ACTION = "climb";
export const CANONICAL_CLIMB_SKILL = "Climbing";
export const LEGACY_CLIMB_SKILL_ALIASES = Object.freeze([
  "Scale Walls",
  "Scaling Walls",
]);

export const CLIMB_FEET_PER_HEIGHT_UNIT = 2.5;
export const DEFAULT_WALL_CLIMB_HEIGHT_FEET = 7.5;
export const MAX_ABSTRACTED_SINGLE_EDGE_CLIMB_FEET = 30;

const toFinite = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalize = (value) =>
  String(value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");

const skillEntryName = (entry) => {
  if (typeof entry === "string") return entry;
  if (Array.isArray(entry)) return entry[0];
  if (entry && typeof entry === "object") {
    return entry.name || entry.label || entry.skillName || entry.id || "";
  }
  return "";
};

export function canonicalizeClimbingSkillName(value) {
  const text = String(value ?? "");
  return text
    .replace(/\bScaling Walls\b/gi, CANONICAL_CLIMB_SKILL)
    .replace(/\bScale Walls\b/gi, CANONICAL_CLIMB_SKILL);
}

export function isClimbingSkillName(value) {
  const normalized = canonicalizeClimbingSkillName(value)
    .replace(/\([^)]*\)/g, "")
    .replace(/[+-]\d+%?/g, "")
    .trim()
    .toLowerCase();
  return normalized === CANONICAL_CLIMB_SKILL.toLowerCase();
}

export function findActorClimbingSkill(actor = {}) {
  const collections = [
    { entries: Array.isArray(actor.skills) ? actor.skills : [], skillType: null, source: "skills" },
    { entries: Array.isArray(actor.electiveSkills) ? actor.electiveSkills : [], skillType: "elective", source: "elective skills" },
    { entries: Array.isArray(actor.occSkills) ? actor.occSkills : [], skillType: "profession", source: "profession skills" },
    { entries: Array.isArray(actor.secondarySkills) ? actor.secondarySkills : [], skillType: "secondary", source: "secondary skills" },
    { entries: Array.isArray(actor.autoRollCharacter?.skills) ? actor.autoRollCharacter.skills : [], skillType: null, source: "public skills" },
    { entries: Object.entries(actor.professionSkills || {}), skillType: "profession", source: "profession skills" },
    { entries: Object.entries(actor.autoRollCharacter?.professionSkills || {}), skillType: "profession", source: "public profession skills" },
  ];

  for (const collection of collections) {
    for (const entry of collection.entries) {
      const name = skillEntryName(entry);
      if (!isClimbingSkillName(name)) continue;
      return {
        trained: true,
        rawName: name,
        canonicalName: canonicalizeClimbingSkillName(name),
        lookupName: "Scale Walls",
        skillType: collection.skillType,
        source: collection.source,
        entry,
      };
    }
  }

  return {
    trained: false,
    rawName: null,
    canonicalName: CANONICAL_CLIMB_SKILL,
    lookupName: "Scale Walls",
    skillType: null,
    source: null,
    entry: null,
  };
}

function getActorAbilityScore(actor = {}) {
  const values = [
    actor.dexterity,
    actor.DEX,
    actor.attributes?.dexterity,
    actor.attributes?.DEX,
    actor.PP,
    actor.attributes?.PP,
    actor.stats?.dexterity,
    actor.stats?.DEX,
    actor.stats?.PP,
  ];
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 10;
}

export function getClimbingAbilityAdjustment(actor = {}) {
  const score = getActorAbilityScore(actor);
  const modifier = Math.floor((score - 10) / 2);
  return clamp(modifier * 2, -10, 12);
}

function getArmorText(actor = {}) {
  return [
    actor.armorProfile?.name,
    actor.armor?.name,
    actor.wornArmor?.name,
    actor.equippedArmor?.name,
    actor.armorName,
    actor.equistaminadArmor?.name,
    actor.equistaminadArmor,
  ].filter(Boolean).join(" ").toLowerCase();
}

function getShieldText(actor = {}) {
  return [
    actor.shieldProfile?.name,
    actor.shield?.name,
    actor.equippedShield?.name,
    actor.equippedShield,
    actor.shieldName,
  ].filter(Boolean).join(" ").toLowerCase();
}

export function getClimbEquipmentBurden(actor = {}) {
  const armorText = getArmorText(actor);
  const shieldText = getShieldText(actor);
  const explicitlyHeavy =
    actor.armorProfile?.heavy === true ||
    actor.encumbrance?.heavy === true;

  let chancePenalty = 0;
  let staminaSurcharge = 0;
  const reasons = [];

  if (
    explicitlyHeavy ||
    /full[ -]?plate|field[ -]?plate|plate armor|plate harness/.test(armorText)
  ) {
    chancePenalty -= 20;
    staminaSurcharge += 2;
    reasons.push("heavy plate");
  } else if (/mail|chain|brigandine|lamellar/.test(armorText)) {
    chancePenalty -= 10;
    staminaSurcharge += 1;
    reasons.push("restrictive armor");
  }

  if (shieldText) {
    const large = /large|tower|kite|heater/.test(shieldText);
    chancePenalty -= large ? 10 : 5;
    staminaSurcharge += 1;
    reasons.push(large ? "large shield" : "shield");
  }

  if (
    actor.encumbrance?.overloaded === true ||
    actor.encumbrance?.status === "overloaded"
  ) {
    chancePenalty -= 15;
    staminaSurcharge += 1;
    reasons.push("overloaded");
  }

  return {
    chancePenalty,
    staminaSurcharge,
    reasons,
  };
}

const SURFACE_PROFILES = Object.freeze({
  "earthen-bank": Object.freeze({
    key: "earthen-bank",
    label: "Earthen bank",
    difficultyModifier: 10,
    failureRisk: "moderate",
  }),
  "rooted-bank": Object.freeze({
    key: "rooted-bank",
    label: "Rooted forest bank",
    difficultyModifier: 10,
    failureRisk: "moderate",
  }),
  "broken-rubble": Object.freeze({
    key: "broken-rubble",
    label: "Broken rubble face",
    difficultyModifier: 5,
    failureRisk: "moderate",
  }),
  "rough-rock": Object.freeze({
    key: "rough-rock",
    label: "Rough rock face",
    difficultyModifier: 0,
    failureRisk: "high",
  }),
  "slippery-earth": Object.freeze({
    key: "slippery-earth",
    label: "Slippery earth",
    difficultyModifier: -10,
    failureRisk: "high",
  }),
  "loose-sand": Object.freeze({
    key: "loose-sand",
    label: "Loose sandy face",
    difficultyModifier: -15,
    failureRisk: "high",
  }),
  "wet-rock": Object.freeze({
    key: "wet-rock",
    label: "Wet rock face",
    difficultyModifier: -15,
    failureRisk: "high",
  }),
  "stone-wall": Object.freeze({
    key: "stone-wall",
    label: "Stone wall",
    difficultyModifier: -10,
    failureRisk: "high",
  }),
  "smooth-masonry": Object.freeze({
    key: "smooth-masonry",
    label: "Smooth masonry",
    difficultyModifier: -20,
    failureRisk: "very-high",
  }),
  "wooden-wall": Object.freeze({
    key: "wooden-wall",
    label: "Wooden wall or palisade",
    difficultyModifier: -5,
    failureRisk: "high",
  }),
  "ladder": Object.freeze({
    key: "ladder",
    label: "Ladder",
    difficultyModifier: 30,
    failureRisk: "low",
  }),
  "rope": Object.freeze({
    key: "rope",
    label: "Rope",
    difficultyModifier: 20,
    failureRisk: "moderate",
  }),
  "tree": Object.freeze({
    key: "tree",
    label: "Tree",
    difficultyModifier: 15,
    failureRisk: "moderate",
  }),
});

function explicitClimbMetadata(cell = {}, direction) {
  const key = direction?.key;
  const sources = [
    cell.climbEdges,
    cell.edgeClimb,
    cell.climbSurfaces,
    cell.edgeTransitions,
    cell.edges,
  ].filter((source) => source && typeof source === "object");

  for (const source of sources) {
    const entry =
      source[key] ??
      source[key?.toLowerCase?.()] ??
      source[direction?.index] ??
      source[String(direction?.index)];
    if (!entry || typeof entry !== "object") continue;
    return entry;
  }
  return {};
}

function inferSurfaceProfile({ transition, fromCell, toCell, direction }) {
  const explicit = {
    ...explicitClimbMetadata(fromCell, direction),
    ...explicitClimbMetadata(toCell, BATTLEFIELD_HEX_DIRECTIONS[direction?.opposite]),
  };
  const explicitKey = normalize(
    explicit.climbSurface ||
    explicit.surface ||
    explicit.surfaceType ||
    ""
  );
  if (explicitKey && SURFACE_PROFILES[explicitKey]) {
    return {
      ...SURFACE_PROFILES[explicitKey],
      difficultyModifier:
        toFinite(explicit.climbDifficultyModifier ?? explicit.difficultyModifier,
          SURFACE_PROFILES[explicitKey].difficultyModifier),
      explicit: true,
      metadata: explicit,
    };
  }

  if (transition?.type === BATTLEFIELD_SLOPE_TRANSITIONS.WALL) {
    const wallText = [
      explicit.material,
      fromCell?.wallMaterial,
      toCell?.wallMaterial,
      fromCell?.structureMaterial,
      toCell?.structureMaterial,
    ].filter(Boolean).join(" ").toLowerCase();
    if (/wood|timber|palisade/.test(wallText)) return { ...SURFACE_PROFILES["wooden-wall"], explicit: false };
    if (/smooth|dressed|polished/.test(wallText)) return { ...SURFACE_PROFILES["smooth-masonry"], explicit: false };
    return { ...SURFACE_PROFILES["stone-wall"], explicit: false };
  }

  const terrain = getBattlefieldCellTerrainKey(
    transition?.deltaHeightUnits >= 0 ? toCell : fromCell
  );
  if (terrain === "rubble") return { ...SURFACE_PROFILES["broken-rubble"], explicit: false };
  if (terrain === "rock") return { ...SURFACE_PROFILES["rough-rock"], explicit: false };
  if (terrain === "mud") return { ...SURFACE_PROFILES["slippery-earth"], explicit: false };
  if (terrain === "sand") return { ...SURFACE_PROFILES["loose-sand"], explicit: false };
  if (terrain === "water") return { ...SURFACE_PROFILES["wet-rock"], explicit: false };
  if (terrain === "forest") return { ...SURFACE_PROFILES["rooted-bank"], explicit: false };
  return { ...SURFACE_PROFILES["earthen-bank"], explicit: false };
}

function resolveVerticalFeet({ transition, fromCell, toCell, surface, direction }) {
  const explicit = {
    ...explicitClimbMetadata(fromCell, direction),
    ...explicitClimbMetadata(toCell, BATTLEFIELD_HEX_DIRECTIONS[direction?.opposite]),
  };
  const explicitFeet = Number(
    explicit.climbHeightFeet ??
    explicit.heightFeet ??
    fromCell?.climbHeightFeet ??
    toCell?.climbHeightFeet
  );
  if (Number.isFinite(explicitFeet) && explicitFeet > 0) return explicitFeet;

  const units = Math.abs(Number(transition?.deltaHeightUnits) || 0);
  if (units > 0) return units * CLIMB_FEET_PER_HEIGHT_UNIT;
  if (transition?.type === BATTLEFIELD_SLOPE_TRANSITIONS.WALL) {
    return DEFAULT_WALL_CLIMB_HEIGHT_FEET;
  }
  return CLIMB_FEET_PER_HEIGHT_UNIT;
}

export function getActorClimbingPercent(actor = {}, getSkillPercentageFn = null) {
  const training = findActorClimbingSkill(actor);
  const abilityAdjustment = getClimbingAbilityAdjustment(actor);

  let basePercent = 25;
  if (training.trained && typeof getSkillPercentageFn === "function") {
    const raw = Number(getSkillPercentageFn(
      actor,
      training.rawName || training.lookupName,
      training.skillType,
    ));
    if (Number.isFinite(raw) && raw > 0) basePercent = raw;
  } else if (training.trained) {
    const embedded = Number(
      training.entry?.percentage ??
      training.entry?.percent ??
      training.entry?.value ??
      actor.climbingPercent ??
      actor.scaleWallsPercent
    );
    basePercent = Number.isFinite(embedded) && embedded > 0 ? embedded : 45;
  }

  return {
    trained: training.trained,
    skillName: CANONICAL_CLIMB_SKILL,
    legacyLookupName: training.lookupName,
    basePercent,
    abilityAdjustment,
    untrained: !training.trained,
  };
}

export function buildClimbOption({
  mapDefinition,
  actor = {},
  from,
  to,
  getSkillPercentageFn = null,
  occupied = new Set(),
} = {}) {
  const direction = getBattlefieldDirectionBetween(from, to);
  if (!direction) return null;
  const transition = getBattlefieldEdgeTransition(mapDefinition, from, direction);
  if (!transition) return null;
  if (![BATTLEFIELD_SLOPE_TRANSITIONS.CLIFF, BATTLEFIELD_SLOPE_TRANSITIONS.WALL].includes(transition.type)) {
    return null;
  }

  const toKey = `${Number(to.x)},${Number(to.y)}`;
  if (occupied?.has?.(toKey)) {
    return {
      accepted: false,
      enabled: false,
      reason: "climb-destination-occupied",
      from: { ...from },
      to: { ...to },
      transition,
      direction,
    };
  }

  const fromCell = getBattlefieldMapCell(mapDefinition, from);
  const toCell = getBattlefieldMapCell(mapDefinition, to);
  if (!fromCell || !toCell) return null;

  const surface = inferSurfaceProfile({ transition, fromCell, toCell, direction });
  const verticalFeet = resolveVerticalFeet({
    transition,
    fromCell,
    toCell,
    surface,
    direction,
  });
  const uphill = transition.deltaHeightUnits > 0 ||
    (transition.deltaHeightUnits === 0 && transition.type === BATTLEFIELD_SLOPE_TRANSITIONS.WALL);
  const downhill = transition.deltaHeightUnits < 0;
  const skill = getActorClimbingPercent(actor, getSkillPercentageFn);
  const equipment = getClimbEquipmentBurden(actor);
  const explicitModifier = toFinite(surface.metadata?.climbDifficultyModifier, 0);
  const targetPercent = clamp(
    skill.basePercent +
    skill.abilityAdjustment +
    surface.difficultyModifier +
    explicitModifier +
    equipment.chancePenalty,
    5,
    95
  );

  const verticalStamina = Math.max(1, Math.ceil(verticalFeet / 10));
  const baseStaminaCost =
    1 +
    verticalStamina +
    (uphill ? 1 : 0) +
    equipment.staminaSurcharge;
  const terrain = resolveBattlefieldSlopeTraversal({
    mapDefinition,
    from,
    to,
    movementMode: CANONICAL_CLIMB_ACTION,
    climbAuthorized: true,
  });
  const terrainStaminaCost = Math.max(0, Number(terrain?.staminaCost) || 0);
  const totalStaminaCost = baseStaminaCost + terrainStaminaCost;
  const actionCost = Math.max(1, Math.min(2, Math.ceil(verticalFeet / 10)));

  return {
    accepted: true,
    enabled: verticalFeet <= MAX_ABSTRACTED_SINGLE_EDGE_CLIMB_FEET,
    reason: verticalFeet > MAX_ABSTRACTED_SINGLE_EDGE_CLIMB_FEET
      ? "cliff-too-high-for-single-edge-climb"
      : null,
    actionKey: CANONICAL_CLIMB_ACTION,
    skillName: CANONICAL_CLIMB_SKILL,
    from: { x: Number(from.x), y: Number(from.y) },
    to: { x: Number(to.x), y: Number(to.y) },
    direction,
    transition,
    surface,
    verticalFeet,
    uphill,
    downhill,
    trained: skill.trained,
    untrained: skill.untrained,
    baseSkillPercent: skill.basePercent,
    abilityAdjustment: skill.abilityAdjustment,
    surfaceModifier: surface.difficultyModifier + explicitModifier,
    equipmentPenalty: equipment.chancePenalty,
    equipmentBurden: equipment,
    targetPercent,
    actionCost,
    baseStaminaCost,
    terrainStaminaCost,
    totalStaminaCost,
    fallHeightFeet: downhill ? verticalFeet : 0,
    traversal: terrain,
  };
}

export function getAdjacentClimbOptions({
  mapDefinition,
  actor = {},
  from,
  positions = {},
  actorId = actor?.id ?? actor?._id,
  getSkillPercentageFn = null,
  isPositionLegal = null,
} = {}) {
  if (!mapDefinition?.grid || !from) return [];
  const occupied = new Set(
    Object.entries(positions || {})
      .filter(([id]) => String(id) !== String(actorId ?? ""))
      .map(([, position]) => `${Number(position?.x)},${Number(position?.y)}`)
  );

  const options = [];
  for (const direction of BATTLEFIELD_HEX_DIRECTIONS) {
    const to = getBattlefieldNeighborOffset(from, direction);
    if (!to) continue;
    if (typeof isPositionLegal === "function" && !isPositionLegal(to)) continue;
    if (!getBattlefieldMapCell(mapDefinition, to)) continue;
    const option = buildClimbOption({
      mapDefinition,
      actor,
      from,
      to,
      getSkillPercentageFn,
      occupied,
    });
    if (option) options.push(option);
  }
  return options;
}

export function resolveClimbAttempt({
  option,
  actor = {},
  roll = null,
  rollPercentile = null,
} = {}) {
  if (!option?.accepted || option?.enabled === false) {
    return {
      accepted: false,
      resolved: false,
      reason: option?.reason || "invalid-climb-option",
      option,
    };
  }

  const rolled = Number.isFinite(Number(roll))
    ? Math.floor(Number(roll))
    : typeof rollPercentile === "function"
      ? Math.floor(Number(rollPercentile()))
      : null;

  if (!Number.isFinite(rolled)) {
    return {
      accepted: true,
      resolved: false,
      preview: true,
      option,
      targetPercent: option.targetPercent,
    };
  }

  const naturalRoll = clamp(rolled, 1, 100);
  const success = naturalRoll <= option.targetPercent;
  const margin = success
    ? option.targetPercent - naturalRoll
    : naturalRoll - option.targetPercent;
  const criticalSuccess = naturalRoll <= 5 || margin >= 40;
  const criticalFailure = naturalRoll >= 96 || (!success && margin >= 40);
  const falls = !success && option.downhill;
  const fallHeightFeet = falls ? option.fallHeightFeet : 0;

  return {
    accepted: true,
    resolved: true,
    success,
    criticalSuccess,
    criticalFailure,
    naturalRoll,
    targetPercent: option.targetPercent,
    margin,
    falls,
    fallHeightFeet,
    destination: success || falls ? { ...option.to } : { ...option.from },
    option,
    actorId: actor?.id ?? actor?._id ?? null,
    staminaCost: option.totalStaminaCost,
    actionCost: option.actionCost,
  };
}

export function chooseAiClimbOption({
  actor = {},
  options = [],
  targetPosition = null,
  calculateDistanceFeet = null,
  minimumSuccessPercent = 45,
} = {}) {
  const actorActions = Number(actor.remainingActions ?? actor.actionsRemaining ?? 0);
  const actorStamina = Number(
    actor.currentStamina ??
    actor.combatStamina?.currentStamina ??
    actor.combatStamina?.current ??
    actor.stamina ??
    0
  );

  const candidates = (Array.isArray(options) ? options : [])
    .filter((option) => option?.accepted && option?.enabled !== false)
    .filter((option) => option.targetPercent >= minimumSuccessPercent)
    .filter((option) => !Number.isFinite(actorActions) || actorActions >= option.actionCost)
    .filter((option) => !Number.isFinite(actorStamina) || actorStamina >= option.totalStaminaCost)
    .map((option) => {
      let distanceImprovement = 0;
      if (targetPosition && typeof calculateDistanceFeet === "function") {
        const before = Number(calculateDistanceFeet(option.from, targetPosition));
        const after = Number(calculateDistanceFeet(option.to, targetPosition));
        if (Number.isFinite(before) && Number.isFinite(after)) {
          distanceImprovement = before - after;
        }
      }
      const fallRiskPenalty = option.downhill ? option.verticalFeet * 1.2 : 0;
      const score =
        distanceImprovement * 12 +
        option.targetPercent * 0.8 -
        option.totalStaminaCost * 6 -
        option.actionCost * 12 -
        fallRiskPenalty;
      return { ...option, aiScore: score, distanceImprovement };
    })
    .filter((option) => !targetPosition || option.distanceImprovement > 0.01)
    .sort((left, right) => (
      right.aiScore - left.aiScore ||
      right.targetPercent - left.targetPercent ||
      left.totalStaminaCost - right.totalStaminaCost ||
      left.to.x - right.to.x ||
      left.to.y - right.to.y
    ));

  const selected = candidates[0] || null;
  return {
    accepted: Boolean(selected),
    reason: selected ? "useful-climb-option" : "no-safe-useful-climb-option",
    option: selected,
    candidates,
  };
}

export function formatClimbOption(option = {}) {
  if (!option?.accepted) return "Unavailable climb";
  const direction = option.direction?.label || option.direction?.key || "Adjacent";
  const movement = option.uphill ? "up" : option.downhill ? "down" : "over";
  return `${direction}: climb ${movement} ${option.verticalFeet} ft ${option.surface?.label || "surface"} ` +
    `(${option.targetPercent}% success, ${option.actionCost} action${option.actionCost === 1 ? "" : "s"}, ` +
    `${option.totalStaminaCost} stamina)`;
}

export default {
  buildClimbOption,
  chooseAiClimbOption,
  findActorClimbingSkill,
  formatClimbOption,
  getAdjacentClimbOptions,
  getActorClimbingPercent,
  resolveClimbAttempt,
};
