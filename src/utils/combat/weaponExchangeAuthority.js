import { getCanonicalWeaponTraitProfile } from "./canonicalWeaponTraits.js";
import { getWeaponTacticalTraits } from "./weaponEngagementAuthority.js";
import { getActiveWeaponConditionPenalties } from "./weaponConditionAuthority.js";
import { getWeaponEntryBalanceAdjustment } from "./weaponBalanceAuthority.js";

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();
const clampD20 = (value) => Math.min(20, Math.max(1, Math.trunc(Number(value) || 1)));
const abilityModifier = (score) => Math.floor(((Number(score) || 10) - 10) / 2);

export const WEAPON_ENTRY_TECHNIQUES = Object.freeze({
  BEAT_AND_ENTER: "beat-and-enter",
  PARRY_AND_ENTER: "parry-and-enter",
  VOID_AND_ENTER: "void-and-enter",
  SHIELD_COVER_AND_ENTER: "shield-cover-and-enter",
  RUSH_THE_POINT: "rush-the-point",
  HALF_SWORD_ENTRY: "half-sword-entry",
});

export const LONG_WEAPON_CONTROL_RESPONSES = Object.freeze({
  STOP_THRUST: "stop-thrust",
  RETREATING_THRUST: "retreating-thrust",
  YIELD_GROUND: "yield-ground-maintain-point",
  BIND_DISPLACE: "bind-displace",
});

export const LONG_WEAPON_CLOSE_ACTIONS = Object.freeze({
  WITHDRAW_TO_MEASURE: "withdraw-to-measure",
  DRAW_SIDEARM: "draw-sidearm",
  SHORTEN_GRIP: "shorten-grip",
  SHAFT_DEFENSE: "shaft-defense",
});

const ENTRY_TECHNIQUE_PROFILES = Object.freeze({
  [WEAPON_ENTRY_TECHNIQUES.BEAT_AND_ENTER]: {
    id: WEAPON_ENTRY_TECHNIQUES.BEAT_AND_ENTER,
    label: "Beat and Enter",
    entryModifier: 2,
    staminaCost: 2,
    riskModifier: 0,
    description: "Strike or displace the point, then cross behind the beat.",
  },
  [WEAPON_ENTRY_TECHNIQUES.PARRY_AND_ENTER]: {
    id: WEAPON_ENTRY_TECHNIQUES.PARRY_AND_ENTER,
    label: "Parry and Enter",
    entryModifier: 1,
    staminaCost: 1,
    riskModifier: -1,
    description: "Receive the thrust on the blade while stepping inside.",
  },
  [WEAPON_ENTRY_TECHNIQUES.VOID_AND_ENTER]: {
    id: WEAPON_ENTRY_TECHNIQUES.VOID_AND_ENTER,
    label: "Void and Enter",
    entryModifier: 1,
    staminaCost: 1,
    riskModifier: 0,
    description: "Slip the line of the point and enter on an angle.",
  },
  [WEAPON_ENTRY_TECHNIQUES.SHIELD_COVER_AND_ENTER]: {
    id: WEAPON_ENTRY_TECHNIQUES.SHIELD_COVER_AND_ENTER,
    label: "Shield Cover and Enter",
    entryModifier: 3,
    staminaCost: 1,
    riskModifier: -2,
    description: "Cover the line with a shield while driving into sword measure.",
  },
  [WEAPON_ENTRY_TECHNIQUES.RUSH_THE_POINT]: {
    id: WEAPON_ENTRY_TECHNIQUES.RUSH_THE_POINT,
    label: "Rush the Point",
    entryModifier: 2,
    staminaCost: 2,
    riskModifier: 2,
    description: "Commit to a fast entry; effective but exposed to a stop-thrust.",
  },
  [WEAPON_ENTRY_TECHNIQUES.HALF_SWORD_ENTRY]: {
    id: WEAPON_ENTRY_TECHNIQUES.HALF_SWORD_ENTRY,
    label: "Half-Sword Entry",
    entryModifier: 5,
    staminaCost: 1,
    riskModifier: -1,
    description: "Grip the blade for leverage and drive the point past the long weapon.",
  },
});

const CONTROL_RESPONSE_PROFILES = Object.freeze({
  [LONG_WEAPON_CONTROL_RESPONSES.STOP_THRUST]: {
    id: LONG_WEAPON_CONTROL_RESPONSES.STOP_THRUST,
    label: "Stop-Thrust",
    controlModifier: 2,
    staminaCost: 1,
    counterAttack: true,
    retreatFeet: 0,
    description: "Threaten the entering fighter with a direct thrust on the line.",
  },
  [LONG_WEAPON_CONTROL_RESPONSES.RETREATING_THRUST]: {
    id: LONG_WEAPON_CONTROL_RESPONSES.RETREATING_THRUST,
    label: "Retreating Thrust",
    controlModifier: 3,
    staminaCost: 1,
    counterAttack: true,
    retreatFeet: 5,
    description: "Give ground while extending the point to preserve measure.",
  },
  [LONG_WEAPON_CONTROL_RESPONSES.YIELD_GROUND]: {
    id: LONG_WEAPON_CONTROL_RESPONSES.YIELD_GROUND,
    label: "Yield Ground and Maintain Point",
    controlModifier: 2,
    staminaCost: 1,
    counterAttack: false,
    retreatFeet: 5,
    description: "Step away without committing to a damaging thrust.",
  },
  [LONG_WEAPON_CONTROL_RESPONSES.BIND_DISPLACE]: {
    id: LONG_WEAPON_CONTROL_RESPONSES.BIND_DISPLACE,
    label: "Bind or Displace",
    controlModifier: 1,
    staminaCost: 1,
    counterAttack: false,
    retreatFeet: 0,
    description: "Use leverage and shaft control to deny the entry.",
  },
});

const getActorDeftnessModifier = (actor = {}) => abilityModifier(
  actor?.attributes?.deftness ??
  actor?.attributes?.dexterity ??
  actor?.abilityScores?.dex ??
  actor?.dex ??
  10,
);

const getWeaponTrainingBonus = (actor = {}, weapon = {}) => {
  const traits = getWeaponTacticalTraits(weapon || {});
  const training = actor?.training?.weapons || actor?.weaponTraining || {};
  const candidates = [
    training?.[traits.family],
    training?.[weapon?.id],
    training?.[weapon?.weaponId],
    actor?.combatTrainingBonus,
    actor?.proficiencyBonus,
  ];
  return Math.max(0, ...candidates.map((value) => Number(value) || 0));
};

const hasShield = (actor = {}) => Boolean(
  actor?.equippedShield || actor?.equipped?.shield || actor?.heldItems?.shield ||
  ![null, undefined, "", "none"].includes(normalizeText(actor?.equipmentSelection?.shield)),
);

export const getWeaponEntryTechniqueOptions = ({ actor, weapon, controllerWeapon } = {}) => {
  const weaponTraits = getWeaponTacticalTraits(weapon || {});
  const controllerTraits = getWeaponTacticalTraits(controllerWeapon || {});
  const options = [
    ENTRY_TECHNIQUE_PROFILES[WEAPON_ENTRY_TECHNIQUES.PARRY_AND_ENTER],
    ENTRY_TECHNIQUE_PROFILES[WEAPON_ENTRY_TECHNIQUES.VOID_AND_ENTER],
    ENTRY_TECHNIQUE_PROFILES[WEAPON_ENTRY_TECHNIQUES.RUSH_THE_POINT],
  ];
  if (weaponTraits.bindStrength >= 1 || weaponTraits.family === "sword") {
    options.unshift(ENTRY_TECHNIQUE_PROFILES[WEAPON_ENTRY_TECHNIQUES.BEAT_AND_ENTER]);
  }
  if (weaponTraits.halfSwordCapable && controllerTraits.isPolearm) {
    options.unshift(ENTRY_TECHNIQUE_PROFILES[WEAPON_ENTRY_TECHNIQUES.HALF_SWORD_ENTRY]);
  }
  if (hasShield(actor)) {
    options.unshift(ENTRY_TECHNIQUE_PROFILES[WEAPON_ENTRY_TECHNIQUES.SHIELD_COVER_AND_ENTER]);
  }
  return options.map((option) => ({
    ...option,
    legal: controllerTraits.reachFeet > weaponTraits.reachFeet + 0.1,
  })).filter((option) => option.legal);
};

export const getLongWeaponControlResponseOptions = ({ controller, weapon, canRetreat = true } = {}) => {
  const traits = getWeaponTacticalTraits(weapon || {});
  if (!traits.isPolearm && traits.reachFeet <= 5) return [];
  const options = [
    CONTROL_RESPONSE_PROFILES[LONG_WEAPON_CONTROL_RESPONSES.STOP_THRUST],
    CONTROL_RESPONSE_PROFILES[LONG_WEAPON_CONTROL_RESPONSES.BIND_DISPLACE],
  ];
  if (canRetreat) {
    options.unshift(CONTROL_RESPONSE_PROFILES[LONG_WEAPON_CONTROL_RESPONSES.RETREATING_THRUST]);
    options.push(CONTROL_RESPONSE_PROFILES[LONG_WEAPON_CONTROL_RESPONSES.YIELD_GROUND]);
  }
  const stamina = Number(
    controller?.fatigueState?.currentStamina ??
    controller?.combatStamina?.currentStamina ??
    controller?.currentStamina ??
    controller?.maxStamina ??
    0,
  );
  return options.filter((option) => stamina <= 0 ? option.staminaCost === 0 : true);
};

export const selectAutomatedEntryTechnique = ({ actor, weapon, controllerWeapon } = {}) => {
  const options = getWeaponEntryTechniqueOptions({ actor, weapon, controllerWeapon });
  if (!options.length) return null;
  const aggression = Number(actor?.behavior?.aggression ?? actor?.aggression ?? 50) || 50;
  const caution = Number(actor?.behavior?.caution ?? actor?.caution ?? 50) || 50;
  if (getWeaponTacticalTraits(weapon || {}).halfSwordCapable && getWeaponTacticalTraits(controllerWeapon || {}).isPolearm) {
    return options.find((option) => option.id === WEAPON_ENTRY_TECHNIQUES.HALF_SWORD_ENTRY) || options[0];
  }
  if (hasShield(actor)) {
    return options.find((option) => option.id === WEAPON_ENTRY_TECHNIQUES.SHIELD_COVER_AND_ENTER) || options[0];
  }
  if (aggression >= 75 && caution < 45) {
    return options.find((option) => option.id === WEAPON_ENTRY_TECHNIQUES.RUSH_THE_POINT) || options[0];
  }
  if (getWeaponTacticalTraits(weapon || {}).bindStrength >= 2) {
    return options.find((option) => option.id === WEAPON_ENTRY_TECHNIQUES.BEAT_AND_ENTER) || options[0];
  }
  return options.find((option) => option.id === WEAPON_ENTRY_TECHNIQUES.PARRY_AND_ENTER) || options[0];
};

export const selectAutomatedLongWeaponResponse = ({ controller, weapon, canRetreat = true } = {}) => {
  const options = getLongWeaponControlResponseOptions({ controller, weapon, canRetreat });
  if (!options.length) return null;
  const stamina = Number(
    controller?.fatigueState?.currentStamina ??
    controller?.combatStamina?.currentStamina ??
    controller?.currentStamina ??
    0,
  );
  const maxStamina = Number(
    controller?.fatigueState?.maxStamina ??
    controller?.combatStamina?.maxStamina ??
    controller?.maxStamina ??
    stamina,
  );
  const lowStamina = maxStamina > 0 && stamina <= maxStamina * 0.25;
  if (canRetreat && !lowStamina) {
    return options.find((option) => option.id === LONG_WEAPON_CONTROL_RESPONSES.RETREATING_THRUST) || options[0];
  }
  if (lowStamina) {
    return options.find((option) => option.id === LONG_WEAPON_CONTROL_RESPONSES.YIELD_GROUND) || options[0];
  }
  return options.find((option) => option.id === LONG_WEAPON_CONTROL_RESPONSES.STOP_THRUST) || options[0];
};

export const resolveMultiOpponentMeasurePressure = ({ interactions = [] } = {}) => {
  const active = (Array.isArray(interactions) ? interactions : [])
    .filter((interaction) => interaction?.decision && interaction.decision.type !== "unrestricted");
  if (!active.length) return { primary: null, supportingControllers: [], controlSupportBonus: 0, interactions: [] };

  const contesting = active.filter((interaction) => interaction.decision?.requiresContest);
  const pool = contesting.length ? contesting : active;
  const ranked = [...pool].sort((left, right) => {
    const leftTraits = left.decision?.opponentTraits || getWeaponTacticalTraits(left.candidateWeapon || {});
    const rightTraits = right.decision?.opponentTraits || getWeaponTacticalTraits(right.candidateWeapon || {});
    const leftControl = Number(leftTraits.pointControl || 0) + Number(leftTraits.entryDenial || 0);
    const rightControl = Number(rightTraits.pointControl || 0) + Number(rightTraits.entryDenial || 0);
    return rightControl - leftControl || Number(left.desiredDistanceFt) - Number(right.desiredDistanceFt);
  });
  const primary = ranked[0] || null;
  const supportingControllers = contesting
    .filter((interaction) => interaction !== primary)
    .map((interaction) => interaction.candidate)
    .filter(Boolean);
  return {
    primary,
    supportingControllers,
    controlSupportBonus: Math.min(3, supportingControllers.length),
    interactions: active,
  };
};

export const resolveWeaponEntryExchange = ({
  mover,
  controller,
  moverWeapon,
  controllerWeapon,
  entryTechnique,
  controlResponse,
  entryRoll,
  controlRoll,
  supportingControllers = [],
  beforeDistanceFt = null,
  desiredDistanceFt = null,
  currentRound = null,
} = {}) => {
  const moverTraits = getWeaponTacticalTraits(moverWeapon || {});
  const controllerTraits = getWeaponTacticalTraits(controllerWeapon || {});
  const entryProfile = typeof entryTechnique === "string"
    ? ENTRY_TECHNIQUE_PROFILES[entryTechnique]
    : entryTechnique;
  const responseProfile = typeof controlResponse === "string"
    ? CONTROL_RESPONSE_PROFILES[controlResponse]
    : controlResponse;
  if (!entryProfile || !responseProfile) {
    return { allowed: false, outcome: "invalid-technique", reason: "entry-technique-or-control-response-missing" };
  }

  const naturalEntry = clampD20(entryRoll);
  const naturalControl = clampD20(controlRoll);
  const supportBonus = Math.min(3, Math.max(0, supportingControllers.length));
  const moverConditionPenalties = getActiveWeaponConditionPenalties(mover, currentRound);
  const controllerConditionPenalties = getActiveWeaponConditionPenalties(controller, currentRound);
  const balanceAdjustment = getWeaponEntryBalanceAdjustment({
    mover,
    moverWeapon,
    controllerWeapon,
    entryTechnique: entryProfile,
  });
  const entryScore =
    naturalEntry +
    getActorDeftnessModifier(mover) +
    getWeaponTrainingBonus(mover, moverWeapon) +
    moverTraits.entryAbility +
    entryProfile.entryModifier +
    moverConditionPenalties.entry +
    balanceAdjustment.adjustment;
  const controlScore =
    naturalControl +
    getActorDeftnessModifier(controller) +
    getWeaponTrainingBonus(controller, controllerWeapon) +
    controllerTraits.pointControl +
    controllerTraits.entryDenial +
    responseProfile.controlModifier +
    supportBonus +
    controllerConditionPenalties.control;
  const margin = entryScore - controlScore;

  let allowed = false;
  let outcome = "narrow-denial";
  if (naturalEntry === 20 && naturalControl !== 20) {
    allowed = true;
    outcome = "critical-entry";
  } else if (naturalControl === 20 && naturalEntry !== 20) {
    allowed = false;
    outcome = "strong-denial";
  } else if (margin >= 5) {
    allowed = true;
    outcome = "strong-entry";
  } else if (margin >= 1) {
    allowed = true;
    outcome = "narrow-entry";
  } else if (margin <= -5) {
    allowed = false;
    outcome = "strong-denial";
  }

  const stopThrustExposed = !allowed && responseProfile.counterAttack === true;
  return {
    type: "weapon-entry-exchange",
    allowed,
    outcome,
    margin,
    entryRoll: naturalEntry,
    controlRoll: naturalControl,
    entryScore,
    controlScore,
    entryTechnique: entryProfile,
    controlResponse: responseProfile,
    supportBonus,
    supportingControllerIds: supportingControllers.map((actor) => actor?.id).filter(Boolean),
    entryStaminaCost: entryProfile.staminaCost,
    controlStaminaCost: responseProfile.staminaCost,
    stopThrustAuthorized: stopThrustExposed,
    retreatFeet: !allowed ? responseProfile.retreatFeet : 0,
    engagementState: allowed ? "inside-the-point" : "long-weapon-measure",
    beforeDistanceFt,
    desiredDistanceFt,
    moverTraits,
    controllerTraits,
    currentRound,
    conditionModifiers: {
      moverEntry: moverConditionPenalties.entry,
      controllerControl: controllerConditionPenalties.control,
      moverSources: moverConditionPenalties.sources,
      controllerSources: controllerConditionPenalties.sources,
    },
    balanceAdjustment,
  };
};

export const buildLongWeaponReactionAttack = ({ weapon, response } = {}) => {
  if (!weapon || !response?.counterAttack) return null;
  return {
    ...weapon,
    id: `${weapon.id || weapon.weaponId || "weapon"}:${response.id}`,
    profileKey: `${weapon.profileKey || weapon.weaponId || weapon.id || "weapon"}:${response.id}`,
    name: response.id === LONG_WEAPON_CONTROL_RESPONSES.RETREATING_THRUST
      ? `${weapon.name || "Long weapon"} Retreating Thrust`
      : `${weapon.name || "Long weapon"} Stop-Thrust`,
    displayName: response.label,
    techniqueKey: response.id,
    selectedTechnique: response.id,
    primaryDelivery: "thrust",
    attackMode: response.id,
    basicAttackStaminaCost: 1,
    isWeaponMeasureReaction: true,
  };
};

export const findSidearmCandidate = ({ fighter, weaponCatalog = [] } = {}) => {
  const readyId = normalizeText(fighter?.combatWeaponState?.readyWeaponId);
  const candidates = [
    ...(Array.isArray(fighter?.inventory) ? fighter.inventory : []),
  ];
  const unique = new Map();
  candidates.forEach((candidate) => {
    if (!candidate) return;
    const fullCandidate = typeof candidate === "string"
      ? weaponCatalog.find((weapon) => normalizeText(weapon?.name) === normalizeText(candidate))
      : candidate;
    if (!fullCandidate) return;
    const canonical = getCanonicalWeaponTraitProfile(fullCandidate);
    const id = normalizeText(fullCandidate.id || fullCandidate.weaponId || fullCandidate.name);
    if (!id || id === readyId) return;
    if ((canonical.family === "sword" || canonical.family === "dagger" || canonical.isLongsword) && canonical.reachFeet <= 5.5) {
      unique.set(id, fullCandidate);
    }
  });
  return [...unique.values()].sort((left, right) => {
    const leftFamily = getCanonicalWeaponTraitProfile(left).family;
    const rightFamily = getCanonicalWeaponTraitProfile(right).family;
    return Number(rightFamily === "sword") - Number(leftFamily === "sword");
  })[0] || null;
};

export const getLongWeaponCloseActionOptions = ({ fighter, weapon, sidearm, canWithdraw = true } = {}) => {
  const traits = getWeaponTacticalTraits(weapon || {});
  if (!traits.isPolearm && traits.reachFeet <= 5.5) return [];
  const options = [];
  if (canWithdraw) options.push({ id: LONG_WEAPON_CLOSE_ACTIONS.WITHDRAW_TO_MEASURE, label: "Withdraw to Measure", actionCost: 1, staminaCost: 1 });
  if (sidearm) options.push({ id: LONG_WEAPON_CLOSE_ACTIONS.DRAW_SIDEARM, label: `Draw ${sidearm.name}`, actionCost: 1, staminaCost: 0, sidearm });
  if (traits.isSpear || traits.isHalberd) options.push({ id: LONG_WEAPON_CLOSE_ACTIONS.SHORTEN_GRIP, label: "Shorten Grip", actionCost: 0, staminaCost: 1 });
  options.push({ id: LONG_WEAPON_CLOSE_ACTIONS.SHAFT_DEFENSE, label: "Use Shaft Defensively", actionCost: 0, staminaCost: 1 });
  return options;
};

export const selectAutomatedLongWeaponCloseAction = ({ fighter, weapon, sidearm, canWithdraw = true } = {}) => {
  const options = getLongWeaponCloseActionOptions({ fighter, weapon, sidearm, canWithdraw });
  if (!options.length) return null;
  const current = Number(fighter?.fatigueState?.currentStamina ?? fighter?.combatStamina?.currentStamina ?? fighter?.currentStamina ?? 0);
  const max = Number(fighter?.fatigueState?.maxStamina ?? fighter?.combatStamina?.maxStamina ?? fighter?.maxStamina ?? current);
  const lowStamina = max > 0 && current <= max * 0.25;
  if (canWithdraw && !lowStamina) return options.find((option) => option.id === LONG_WEAPON_CLOSE_ACTIONS.WITHDRAW_TO_MEASURE) || options[0];
  if (sidearm) return options.find((option) => option.id === LONG_WEAPON_CLOSE_ACTIONS.DRAW_SIDEARM) || options[0];
  return options.find((option) => option.id === LONG_WEAPON_CLOSE_ACTIONS.SHORTEN_GRIP) || options[0];
};

export const simulateWeaponEntryExchanges = ({
  iterations = 1000,
  nextD20,
  mover,
  controller,
  moverWeapon,
  controllerWeapon,
  entryTechnique,
  controlResponse,
  supportingControllers = [],
} = {}) => {
  const count = Math.max(1, Math.trunc(Number(iterations) || 1));
  const roller = typeof nextD20 === "function" ? nextD20 : () => 10;
  const outcomes = {};
  let entries = 0;
  let denials = 0;
  let stopThrusts = 0;
  for (let index = 0; index < count; index += 1) {
    const result = resolveWeaponEntryExchange({
      mover,
      controller,
      moverWeapon,
      controllerWeapon,
      entryTechnique,
      controlResponse,
      entryRoll: roller(),
      controlRoll: roller(),
      supportingControllers,
    });
    outcomes[result.outcome] = (outcomes[result.outcome] || 0) + 1;
    if (result.allowed) entries += 1;
    else denials += 1;
    if (result.stopThrustAuthorized) stopThrusts += 1;
  }
  return {
    iterations: count,
    entries,
    denials,
    entryRate: entries / count,
    denialRate: denials / count,
    stopThrustRate: stopThrusts / count,
    outcomes,
  };
};
