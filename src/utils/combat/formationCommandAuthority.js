import {
  FORMATION_COHESION_STATES,
  resolveSpatialFormationSupport,
} from "./formationCohesionAuthority.js";
import { WEAPON_CONDITION_TYPES } from "./weaponConditionAuthority.js";

const normalizeText = (value) => String(value ?? "").trim().toLowerCase().replaceAll("_", "-");
const toFinite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const getActorId = (actor) => actor?.id || actor?._id || null;
const getAvailableActions = (actor) => toFinite(actor?.remainingActions, Number.POSITIVE_INFINITY);
const getAvailableStamina = (actor) => toFinite(actor?.combatStamina?.current ?? actor?.stamina, Number.POSITIVE_INFINITY);
const canAffordCommand = (actor, command) => (
  getAvailableActions(actor) >= toFinite(command?.actionCost, 0) &&
  getAvailableStamina(actor) >= toFinite(command?.staminaCost, 0)
);

export const FORMATION_COMMANDS = Object.freeze({
  REFORM_LINE: "reform-line",
  RALLY_FORMATION: "rally-formation",
  CLOSE_RANKS: "close-ranks",
  ANCHOR_POSITION: "anchor-position",
  WITHDRAW_IN_ORDER: "withdraw-in-order",
});

const COMMANDS = Object.freeze({
  [FORMATION_COMMANDS.REFORM_LINE]: Object.freeze({ id: FORMATION_COMMANDS.REFORM_LINE, label: "Reform Line", actionCost: 1, staminaCost: 1 }),
  [FORMATION_COMMANDS.RALLY_FORMATION]: Object.freeze({ id: FORMATION_COMMANDS.RALLY_FORMATION, label: "Rally Formation", actionCost: 1, staminaCost: 1 }),
  [FORMATION_COMMANDS.CLOSE_RANKS]: Object.freeze({ id: FORMATION_COMMANDS.CLOSE_RANKS, label: "Close Ranks", actionCost: 1, staminaCost: 1 }),
  [FORMATION_COMMANDS.ANCHOR_POSITION]: Object.freeze({ id: FORMATION_COMMANDS.ANCHOR_POSITION, label: "Anchor Position", actionCost: 1, staminaCost: 1 }),
  [FORMATION_COMMANDS.WITHDRAW_IN_ORDER]: Object.freeze({ id: FORMATION_COMMANDS.WITHDRAW_IN_ORDER, label: "Withdraw in Order", actionCost: 1, staminaCost: 1 }),
});

export {
  filterFormationCommandOptionsForTurnReceipt,
  recordFormationCommandReceipt,
} from "./formationCommandTurnReceipt.js";

const isDisrupted = (actor, currentRound = null) => {
  if (actor?.formationState?.recoveryRequired === true || actor?.formationState?.status === FORMATION_COHESION_STATES.DISRUPTED) return true;
  return (Array.isArray(actor?.statusEffects) ? actor.statusEffects : []).some((entry) => {
    const type = normalizeText(typeof entry === "string" ? entry : entry?.type || entry?.id);
    if (type !== WEAPON_CONDITION_TYPES.FORMATION_DISRUPTED) return false;
    if (typeof entry === "string") return true;
    if (entry.active === false || entry.expired === true) return false;
    const round = Number(currentRound);
    const expires = Number(entry.expiresRound);
    return !Number.isFinite(round) || !Number.isFinite(expires) || round <= expires || entry.persistentUntilRecovered === true;
  });
};

export const clearFormationDisruption = (actor, {
  currentRound = 0,
  status = FORMATION_COHESION_STATES.LOOSE,
  source = "formation-command",
} = {}) => {
  if (!actor) return actor;
  const nextStatuses = (Array.isArray(actor.statusEffects) ? actor.statusEffects : []).filter((entry) => (
    normalizeText(typeof entry === "string" ? entry : entry?.type || entry?.id) !== WEAPON_CONDITION_TYPES.FORMATION_DISRUPTED
  ));
  return {
    ...actor,
    statusEffects: nextStatuses,
    formationState: {
      ...(actor.formationState || {}),
      status,
      recoveryRequired: false,
      recoveredRound: currentRound,
      recoverySource: source,
      anchored: false,
    },
  };
};

export const getFormationCommandOptions = ({
  actor,
  target = null,
  combatants = [],
  positions = {},
  getWeapon = null,
  calculateDistanceFeet = null,
  currentRound = null,
  terrainContext = null,
} = {}) => {
  if (!actor || actor.dead || actor.defeated || actor.unconscious || actor.routed) return [];
  const disrupted = isDisrupted(actor, currentRound);
  const formationActor = disrupted
    ? clearFormationDisruption(actor, {
      currentRound,
      status: FORMATION_COHESION_STATES.LOOSE,
      source: "formation-command-preview",
    })
    : actor;
  const formationCombatants = (Array.isArray(combatants) ? combatants : []).map((entry) => (
    getActorId(entry) === getActorId(actor) ? formationActor : entry
  ));
  const formation = resolveSpatialFormationSupport({
    actor: formationActor,
    target,
    combatants: formationCombatants,
    positions,
    getWeapon,
    calculateDistanceFeet,
    currentRound,
    terrainContext,
  });
  const options = [];
  const addOption = (commandId, reason) => {
    const command = COMMANDS[commandId];
    if (command && canAffordCommand(actor, command)) options.push({ ...command, reason });
  };
  if (disrupted && formation.supporterIds.length > 0) addOption(FORMATION_COMMANDS.REFORM_LINE, "restore-spatial-line");
  if (disrupted) addOption(FORMATION_COMMANDS.RALLY_FORMATION, "discipline-recovery");
  const alreadyClosedRanksThisRound = Number(actor?.formationState?.closeRanksRound) === Number(currentRound);
  if (!alreadyClosedRanksThisRound && (formation.supporterIds.length === 0 || formation.state === FORMATION_COHESION_STATES.LOOSE)) {
    addOption(FORMATION_COMMANDS.CLOSE_RANKS, "seek-adjacent-support");
  }
  if (!disrupted && formation.supportBonus > 0 && actor?.formationState?.anchored !== true) {
    addOption(FORMATION_COMMANDS.ANCHOR_POSITION, "hold-ground");
  }
  const alreadyWithdrewThisRound = Number(actor?.formationState?.orderedWithdrawalRound) === Number(currentRound);
  if (!alreadyWithdrewThisRound && formation.supportBonus > 0) {
    addOption(FORMATION_COMMANDS.WITHDRAW_IN_ORDER, "retain-cohesion-while-retreating");
  }
  return options;
};

const getDisciplineModifier = (actor = {}) => {
  const score = toFinite(actor?.attributes?.discipline ?? actor?.discipline ?? actor?.resolve ?? actor?.attributes?.resolve, 10);
  const proficiency = toFinite(actor?.proficiencyBonus ?? actor?.training?.formationDrill, 0);
  return Math.floor((score - 10) / 2) + proficiency;
};

export const resolveFormationCommand = ({
  commandId,
  actor,
  target = null,
  combatants = [],
  positions = {},
  getWeapon = null,
  calculateDistanceFeet = null,
  currentRound = 0,
  roll = 10,
  terrainContext = null,
  movementCandidate = null,
} = {}) => {
  const command = COMMANDS[commandId];
  if (!command || !actor) return { accepted: false, reason: "invalid-command" };
  if (getAvailableActions(actor) < toFinite(command.actionCost, 0)) {
    return { accepted: false, reason: "insufficient-actions", command };
  }
  if (getAvailableStamina(actor) < toFinite(command.staminaCost, 0)) {
    return { accepted: false, reason: "insufficient-stamina", command };
  }
  const disrupted = isDisrupted(actor, currentRound);
  const formationActor = disrupted
    ? clearFormationDisruption(actor, {
      currentRound,
      status: FORMATION_COHESION_STATES.LOOSE,
      source: "formation-command-preview",
    })
    : actor;
  const formationCombatants = (Array.isArray(combatants) ? combatants : []).map((entry) => (
    getActorId(entry) === getActorId(actor) ? formationActor : entry
  ));
  const formation = resolveSpatialFormationSupport({
    actor: formationActor,
    target,
    combatants: formationCombatants,
    positions,
    getWeapon,
    calculateDistanceFeet,
    currentRound,
    terrainContext,
  });
  const result = {
    accepted: true,
    command,
    actionCost: command.actionCost,
    staminaCost: command.staminaCost,
    actorId: getActorId(actor),
    formationBefore: formation,
    movement: null,
    success: true,
    score: null,
    difficulty: null,
  };

  if (commandId === FORMATION_COMMANDS.REFORM_LINE) {
    if (!isDisrupted(actor, currentRound)) return { ...result, accepted: false, reason: "formation-not-disrupted" };
    if (formation.supporterIds.length === 0) return { ...result, accepted: false, reason: "no-supporting-line" };
    result.updatedActor = clearFormationDisruption(actor, {
      currentRound,
      status: formation.supporterIds.length >= 2 ? FORMATION_COHESION_STATES.ORDERED_LINE : FORMATION_COHESION_STATES.SUPPORTED,
      source: commandId,
    });
    return result;
  }

  if (commandId === FORMATION_COMMANDS.RALLY_FORMATION) {
    if (!isDisrupted(actor, currentRound)) return { ...result, accepted: false, reason: "formation-not-disrupted" };
    const terrainPenalty = Math.min(2, Math.max(0, -(terrainContext?.cohesionModifier || 0)));
    const difficulty = 12 + terrainPenalty + (terrainContext?.rearPressure ? 2 : terrainContext?.flanked ? 1 : 0);
    const score = Math.max(1, Math.min(20, toFinite(roll, 10))) + getDisciplineModifier(actor);
    result.score = score;
    result.difficulty = difficulty;
    result.success = score >= difficulty;
    result.updatedActor = result.success
      ? clearFormationDisruption(actor, { currentRound, status: FORMATION_COHESION_STATES.LOOSE, source: commandId })
      : actor;
    return result;
  }

  if (commandId === FORMATION_COMMANDS.CLOSE_RANKS) {
    if (!movementCandidate) return { ...result, accepted: false, reason: "no-close-ranks-destination" };
    result.movement = { ...movementCandidate, mode: commandId };
    const remainsDisrupted = isDisrupted(actor, currentRound);
    result.updatedActor = {
      ...actor,
      formationState: {
        ...(actor.formationState || {}),
        status: remainsDisrupted
          ? FORMATION_COHESION_STATES.DISRUPTED
          : FORMATION_COHESION_STATES.LOOSE,
        recoveryRequired: remainsDisrupted,
        anchored: false,
        closeRanksRound: currentRound,
      },
    };
    return result;
  }

  if (commandId === FORMATION_COMMANDS.ANCHOR_POSITION) {
    if (formation.supportBonus <= 0) return { ...result, accepted: false, reason: "formation-not-supported" };
    result.updatedActor = {
      ...actor,
      formationState: {
        ...(actor.formationState || {}),
        status: formation.state,
        anchored: true,
        anchoredRound: currentRound,
        recoveryRequired: false,
      },
    };
    result.controlModifier = 1;
    result.movementRestriction = "breaks-on-voluntary-movement";
    return result;
  }

  if (commandId === FORMATION_COMMANDS.WITHDRAW_IN_ORDER) {
    if (formation.supportBonus <= 0) return { ...result, accepted: false, reason: "formation-not-supported" };
    if (!movementCandidate) return { ...result, accepted: false, reason: "no-ordered-withdrawal-destination" };
    result.movement = { ...movementCandidate, mode: commandId };
    result.updatedActor = {
      ...actor,
      formationState: {
        ...(actor.formationState || {}),
        status: formation.state,
        anchored: false,
        orderedWithdrawalRound: currentRound,
      },
    };
    return result;
  }

  return { ...result, accepted: false, reason: "unhandled-command" };
};

export const selectAutomatedFormationCommand = ({
  actor,
  options = [],
  formation = null,
  stamina = null,
  movementPlans = null,
  targetDistanceFeet = null,
  terrainContext = null,
} = {}) => {
  if (!actor || !Array.isArray(options) || options.length === 0) return null;
  const availableStamina = toFinite(stamina ?? actor?.combatStamina?.current ?? actor?.stamina, 0);
  const find = (id) => options.find((option) => option.id === id) || null;
  const closeRanks = movementPlans?.[FORMATION_COMMANDS.CLOSE_RANKS]?.accepted
    ? find(FORMATION_COMMANDS.CLOSE_RANKS)
    : null;
  const withdraw = movementPlans?.[FORMATION_COMMANDS.WITHDRAW_IN_ORDER]?.accepted
    ? find(FORMATION_COMMANDS.WITHDRAW_IN_ORDER)
    : null;
  const currentHp = toFinite(actor?.currentHP ?? actor?.HP ?? actor?.hp, 0);
  const maximumHp = Math.max(1, toFinite(actor?.maxHP ?? actor?.maximumHP ?? actor?.hitPoints ?? currentHp, Math.max(1, currentHp)));
  const healthRatio = currentHp / maximumHp;
  const targetDistance = toFinite(targetDistanceFeet, Number.POSITIVE_INFINITY);
  const pressured = Boolean(terrainContext?.rearPressure || terrainContext?.flanked);

  if (isDisrupted(actor)) {
    // The option authority already proves whether a supporting line exists.
    // Prefer an immediate Reform Line when legal; otherwise move into support
    // before attempting an isolated discipline rally.
    return find(FORMATION_COMMANDS.REFORM_LINE) || closeRanks || find(FORMATION_COMMANDS.RALLY_FORMATION);
  }
  if (withdraw && (pressured || healthRatio <= 0.35 || (availableStamina <= 3 && targetDistance <= 10.1))) {
    return withdraw;
  }
  if (closeRanks && (formation?.supportBonus <= 0 || formation?.state === FORMATION_COHESION_STATES.LOOSE)) {
    return closeRanks;
  }
  if (availableStamina <= 3) return find(FORMATION_COMMANDS.ANCHOR_POSITION) || withdraw || closeRanks;
  if (formation?.supportBonus > 0 && actor?.formationState?.anchored !== true) {
    return find(FORMATION_COMMANDS.ANCHOR_POSITION);
  }
  return closeRanks ||
    find(FORMATION_COMMANDS.ANCHOR_POSITION) ||
    find(FORMATION_COMMANDS.REFORM_LINE) ||
    find(FORMATION_COMMANDS.RALLY_FORMATION) ||
    null;
};
