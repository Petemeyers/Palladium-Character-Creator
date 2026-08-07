import { getCanonicalWeaponTraitProfile } from "./canonicalWeaponTraits.js";
import {
  getWeaponTacticalTraits,
  resolveWeaponEngagementMeasure,
  WEAPON_ENGAGEMENT_MEASURES,
} from "./weaponEngagementAuthority.js";
import { createWeaponCondition, WEAPON_CONDITION_TYPES } from "./weaponConditionAuthority.js";
import { getSpecializedWeaponBalanceAdjustment } from "./weaponBalanceAuthority.js";

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();
const toFinite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const SPECIALIZED_WEAPON_ACTIONS = Object.freeze({
  GREATSWORD_BEAT_ASIDE: "polearm-beat-entry",
  GREATSWORD_CUT_SHAFT: "shaft-cut",
  HALF_SWORD_ENTRY: "half-sword-entry",
  PIKE_SET_POINT: "set-pike",
  PIKE_WITHDRAW_POINT: "withdraw-point",
  HALBERD_POINT_THRUST: "halberd-point-thrust",
  HALBERD_HOOK_AND_DRAW: "halberd-hook-and-draw",
  HALBERD_HEAVY_CHOP: "halberd-heavy-chop",
  AXE_HOOK_GUARD: "axe-hook-guard",
  AXE_HEW_OPENING: "axe-hew-opening",
  MACE_CRUSH_ARMOR: "mace-crush-armor",
  MACE_BREAK_GUARD: "mace-break-guard",
  DAGGER_CLOSE_THRUST: "dagger-close-thrust",
  DAGGER_GRAPPLE_POINT: "dagger-grapple-point",
  SHIELD_BIND_AND_STRIKE: "shield-bind-and-strike",
});

const SPECIALIZED_ACTION_PROFILES = Object.freeze({
  [SPECIALIZED_WEAPON_ACTIONS.GREATSWORD_BEAT_ASIDE]: Object.freeze({
    id: SPECIALIZED_WEAPON_ACTIONS.GREATSWORD_BEAT_ASIDE,
    label: "Beat Aside and Enter",
    family: "greatsword-anti-polearm",
    staminaCost: 2,
    attackModifier: 0,
    controlModifier: 3,
    effect: "negate-polearm-measure",
    description: "Displace the point with the strong of the blade and enter behind it.",
  }),
  [SPECIALIZED_WEAPON_ACTIONS.GREATSWORD_CUT_SHAFT]: Object.freeze({
    id: SPECIALIZED_WEAPON_ACTIONS.GREATSWORD_CUT_SHAFT,
    label: "Cut the Wooden Shaft",
    family: "greatsword-anti-polearm",
    staminaCost: 2,
    attackModifier: 0,
    controlModifier: 0,
    effect: "damage-weapon-shaft",
    description: "Commit a powerful edge strike against a destructible wooden shaft.",
  }),
  [SPECIALIZED_WEAPON_ACTIONS.HALF_SWORD_ENTRY]: Object.freeze({
    id: SPECIALIZED_WEAPON_ACTIONS.HALF_SWORD_ENTRY,
    label: "Half-Sword Entry",
    family: "half-sword",
    staminaCost: 1,
    attackModifier: 0,
    controlModifier: 3,
    effect: "half-sword-parity",
    description: "Grip the blade to gain leverage and contest the long weapon's point.",
  }),
  [SPECIALIZED_WEAPON_ACTIONS.PIKE_SET_POINT]: Object.freeze({
    id: SPECIALIZED_WEAPON_ACTIONS.PIKE_SET_POINT,
    label: "Set the Pike",
    family: "pike",
    staminaCost: 1,
    attackModifier: 1,
    controlModifier: 3,
    effect: "set-pike-control",
    description: "Anchor the point on the approach line and maximize entry denial.",
  }),
  [SPECIALIZED_WEAPON_ACTIONS.PIKE_WITHDRAW_POINT]: Object.freeze({
    id: SPECIALIZED_WEAPON_ACTIONS.PIKE_WITHDRAW_POINT,
    label: "Withdraw the Point",
    family: "pike",
    staminaCost: 1,
    attackModifier: -1,
    controlModifier: 2,
    effect: "restore-pike-measure",
    description: "Recover the point backward instead of attempting a cramped full thrust.",
  }),
  [SPECIALIZED_WEAPON_ACTIONS.HALBERD_POINT_THRUST]: Object.freeze({
    id: SPECIALIZED_WEAPON_ACTIONS.HALBERD_POINT_THRUST,
    label: "Point Thrust",
    family: "halberd",
    staminaCost: 1,
    attackModifier: 1,
    controlModifier: 1,
    effect: "halberd-thrust",
    description: "Use the top spike to contest measure like a shorter spear.",
  }),
  [SPECIALIZED_WEAPON_ACTIONS.HALBERD_HOOK_AND_DRAW]: Object.freeze({
    id: SPECIALIZED_WEAPON_ACTIONS.HALBERD_HOOK_AND_DRAW,
    label: "Hook and Draw",
    family: "halberd",
    staminaCost: 2,
    attackModifier: 0,
    controlModifier: 2,
    effect: "halberd-hook-control",
    description: "Catch a limb, shield, or weapon and pull the opponent off line.",
  }),
  [SPECIALIZED_WEAPON_ACTIONS.HALBERD_HEAVY_CHOP]: Object.freeze({
    id: SPECIALIZED_WEAPON_ACTIONS.HALBERD_HEAVY_CHOP,
    label: "Heavy Chop",
    family: "halberd",
    staminaCost: 2,
    attackModifier: 1,
    controlModifier: -1,
    effect: "halberd-chop",
    description: "Commit the axe head once the opponent is inside the point.",
  }),
  [SPECIALIZED_WEAPON_ACTIONS.AXE_HOOK_GUARD]: Object.freeze({
    id: SPECIALIZED_WEAPON_ACTIONS.AXE_HOOK_GUARD,
    label: "Hook Shield or Guard",
    family: "axe",
    staminaCost: 2,
    attackModifier: 0,
    controlModifier: 2,
    effect: "axe-hook-control",
    description: "Use the beard or head to pull a shield, arm, or weapon line aside.",
  }),
  [SPECIALIZED_WEAPON_ACTIONS.AXE_HEW_OPENING]: Object.freeze({
    id: SPECIALIZED_WEAPON_ACTIONS.AXE_HEW_OPENING,
    label: "Hew Through the Guard",
    family: "axe",
    staminaCost: 2,
    attackModifier: 1,
    controlModifier: 0,
    effect: "axe-guard-pressure",
    description: "Commit a descending or diagonal cut against the opponent's guard structure.",
  }),
  [SPECIALIZED_WEAPON_ACTIONS.MACE_CRUSH_ARMOR]: Object.freeze({
    id: SPECIALIZED_WEAPON_ACTIONS.MACE_CRUSH_ARMOR,
    label: "Crushing Armor Blow",
    family: "impact",
    staminaCost: 2,
    attackModifier: 1,
    controlModifier: 0,
    effect: "impact-armor-trauma",
    description: "Commit the head against rigid protection to transfer blunt force.",
  }),
  [SPECIALIZED_WEAPON_ACTIONS.MACE_BREAK_GUARD]: Object.freeze({
    id: SPECIALIZED_WEAPON_ACTIONS.MACE_BREAK_GUARD,
    label: "Break the Guard",
    family: "impact",
    staminaCost: 2,
    attackModifier: 0,
    controlModifier: 2,
    effect: "impact-guard-disruption",
    description: "Strike the weapon, shield, or arms hard enough to disrupt defensive structure.",
  }),
  [SPECIALIZED_WEAPON_ACTIONS.DAGGER_CLOSE_THRUST]: Object.freeze({
    id: SPECIALIZED_WEAPON_ACTIONS.DAGGER_CLOSE_THRUST,
    label: "Close Thrust",
    family: "dagger",
    staminaCost: 1,
    attackModifier: 2,
    controlModifier: 0,
    effect: "dagger-close-thrust",
    description: "Exploit the dagger's quick handling once the fight reaches close measure.",
  }),
  [SPECIALIZED_WEAPON_ACTIONS.DAGGER_GRAPPLE_POINT]: Object.freeze({
    id: SPECIALIZED_WEAPON_ACTIONS.DAGGER_GRAPPLE_POINT,
    label: "Grapple-Point Thrust",
    family: "dagger",
    staminaCost: 1,
    attackModifier: 2,
    controlModifier: 1,
    effect: "dagger-grapple-point",
    description: "Use an established clinch or grapple to seek a controlled opening.",
  }),
  [SPECIALIZED_WEAPON_ACTIONS.SHIELD_BIND_AND_STRIKE]: Object.freeze({
    id: SPECIALIZED_WEAPON_ACTIONS.SHIELD_BIND_AND_STRIKE,
    label: "Shield Bind and Strike",
    family: "shield",
    staminaCost: 1,
    attackModifier: 1,
    controlModifier: 2,
    effect: "shield-bind-control",
    description: "Use the shield to occupy the opposing weapon line while striking around it.",
  }),
});

export const getSpecializedWeaponActionProfile = (actionId) => (
  SPECIALIZED_ACTION_PROFILES[normalizeText(actionId)] || null
);

const getActorShield = (actor = {}) => {
  const candidate = actor?.equippedShield || actor?.equipped?.shield || actor?.heldItems?.shield || actor?.equipmentSelection?.shield || null;
  if (!candidate || normalizeText(candidate?.name || candidate) === "none") return null;
  return typeof candidate === "string" ? { name: candidate, type: "shield" } : candidate;
};

const getArmorProtection = (actor = {}) => Math.max(0, toFinite(
  actor?.armorRating ?? actor?.AR ?? actor?.derivedStats?.armorRating ?? actor?.armorProfile?.totalArmorarmorDurability,
  0,
));

const isActiveGrapple = (actor = {}) => {
  const state = normalizeText(actor?.grappleState?.state || actor?.grappleState?.positionState);
  return Boolean(actor?.grappleState?.opponent) || !["", "neutral", "none"].includes(state);
};

export const getSpecializedWeaponActionOptions = ({
  actor,
  weapon,
  opponent,
  opponentWeapon,
  distanceFt = 0,
  formationSupported = false,
} = {}) => {
  const actorTraits = getWeaponTacticalTraits(weapon || {});
  const opponentTraits = getWeaponTacticalTraits(opponentWeapon || {});
  const measure = resolveWeaponEngagementMeasure({
    distanceFt,
    attackerWeapon: weapon,
    defenderWeapon: opponentWeapon,
  });
  const options = [];

  if (actorTraits.isGreatsword && opponentTraits.isPolearm) {
    if ([WEAPON_ENGAGEMENT_MEASURES.LONG_WEAPON, WEAPON_ENGAGEMENT_MEASURES.OUTSIDE].includes(measure)) {
      options.push(SPECIALIZED_ACTION_PROFILES[SPECIALIZED_WEAPON_ACTIONS.GREATSWORD_BEAT_ASIDE]);
    }
    if (
      opponentTraits.shaftDestructible &&
      measure !== WEAPON_ENGAGEMENT_MEASURES.CLINCH &&
      toFinite(distanceFt) <= Math.max(10, opponentTraits.reachFeet + 0.5)
    ) {
      options.push(SPECIALIZED_ACTION_PROFILES[SPECIALIZED_WEAPON_ACTIONS.GREATSWORD_CUT_SHAFT]);
    }
  }

  if (actorTraits.isPike) {
    if (measure === WEAPON_ENGAGEMENT_MEASURES.LONG_WEAPON || measure === WEAPON_ENGAGEMENT_MEASURES.OUTSIDE) {
      options.push({
        ...SPECIALIZED_ACTION_PROFILES[SPECIALIZED_WEAPON_ACTIONS.PIKE_SET_POINT],
        controlModifier: SPECIALIZED_ACTION_PROFILES[SPECIALIZED_WEAPON_ACTIONS.PIKE_SET_POINT].controlModifier +
          (formationSupported ? 2 : 0),
        formationSupported: Boolean(formationSupported),
      });
    }
    if (measure === WEAPON_ENGAGEMENT_MEASURES.INSIDE_POINT) {
      options.push(SPECIALIZED_ACTION_PROFILES[SPECIALIZED_WEAPON_ACTIONS.PIKE_WITHDRAW_POINT]);
    }
  }

  if (actorTraits.isHalberd) {
    if (measure === WEAPON_ENGAGEMENT_MEASURES.LONG_WEAPON) {
      options.push(SPECIALIZED_ACTION_PROFILES[SPECIALIZED_WEAPON_ACTIONS.HALBERD_POINT_THRUST]);
    }
    if (measure !== WEAPON_ENGAGEMENT_MEASURES.OUTSIDE && measure !== WEAPON_ENGAGEMENT_MEASURES.CLINCH) {
      options.push(SPECIALIZED_ACTION_PROFILES[SPECIALIZED_WEAPON_ACTIONS.HALBERD_HOOK_AND_DRAW]);
    }
    if (measure === WEAPON_ENGAGEMENT_MEASURES.INSIDE_POINT || toFinite(distanceFt) <= 5.5) {
      options.push(SPECIALIZED_ACTION_PROFILES[SPECIALIZED_WEAPON_ACTIONS.HALBERD_HEAVY_CHOP]);
    }
  }

  if (actorTraits.family === "axe") {
    if (toFinite(distanceFt) <= 5.5 && (getActorShield(opponent) || opponentTraits.isSword || opponentTraits.isPolearm)) {
      options.push(SPECIALIZED_ACTION_PROFILES[SPECIALIZED_WEAPON_ACTIONS.AXE_HOOK_GUARD]);
    }
    if (toFinite(distanceFt) <= 5.5) {
      options.push(SPECIALIZED_ACTION_PROFILES[SPECIALIZED_WEAPON_ACTIONS.AXE_HEW_OPENING]);
    }
  }

  if (actorTraits.family === "impact") {
    if (getArmorProtection(opponent) > 0) {
      options.push(SPECIALIZED_ACTION_PROFILES[SPECIALIZED_WEAPON_ACTIONS.MACE_CRUSH_ARMOR]);
    }
    if (toFinite(distanceFt) <= 5.5) {
      options.push(SPECIALIZED_ACTION_PROFILES[SPECIALIZED_WEAPON_ACTIONS.MACE_BREAK_GUARD]);
    }
  }

  if (actorTraits.family === "dagger") {
    if (measure === WEAPON_ENGAGEMENT_MEASURES.INSIDE_POINT || measure === WEAPON_ENGAGEMENT_MEASURES.CLINCH || toFinite(distanceFt) <= 5.5) {
      options.push(SPECIALIZED_ACTION_PROFILES[SPECIALIZED_WEAPON_ACTIONS.DAGGER_CLOSE_THRUST]);
    }
    if (isActiveGrapple(actor) || isActiveGrapple(opponent) || measure === WEAPON_ENGAGEMENT_MEASURES.CLINCH) {
      options.push(SPECIALIZED_ACTION_PROFILES[SPECIALIZED_WEAPON_ACTIONS.DAGGER_GRAPPLE_POINT]);
    }
  }

  if (getActorShield(actor) && toFinite(distanceFt) <= 5.5 && actorTraits.oneHanded) {
    options.push(SPECIALIZED_ACTION_PROFILES[SPECIALIZED_WEAPON_ACTIONS.SHIELD_BIND_AND_STRIKE]);
  }

  const currentStamina = toFinite(
    actor?.fatigueState?.currentStamina ??
    actor?.combatStamina?.currentStamina ??
    actor?.currentStamina,
    0,
  );
  return options
    .filter(Boolean)
    .filter((option) => currentStamina > 0 || toFinite(option.staminaCost) === 0)
    .map((option) => ({
      ...option,
      measure,
      actorWeaponFamily: actorTraits.family,
      opponentWeaponFamily: opponentTraits.family,
      opponentId: opponent?.id || null,
    }));
};

export const selectAutomatedSpecializedWeaponAction = (context = {}) => {
  const options = getSpecializedWeaponActionOptions(context);
  if (!options.length) return null;
  const actor = context.actor || {};
  const aggression = toFinite(actor?.behavior?.aggression ?? actor?.behaviorProfile?.aggression ?? actor?.aggression, 50);
  const caution = toFinite(actor?.behavior?.caution ?? actor?.behaviorProfile?.caution ?? actor?.caution, 50);
  const preferredIds = [];

  if (context.formationSupported) preferredIds.push(SPECIALIZED_WEAPON_ACTIONS.PIKE_SET_POINT);
  if (aggression >= 65) {
    preferredIds.push(
      SPECIALIZED_WEAPON_ACTIONS.GREATSWORD_CUT_SHAFT,
      SPECIALIZED_WEAPON_ACTIONS.HALBERD_HEAVY_CHOP,
      SPECIALIZED_WEAPON_ACTIONS.GREATSWORD_BEAT_ASIDE,
    );
  }
  if (caution >= 60) {
    preferredIds.push(
      SPECIALIZED_WEAPON_ACTIONS.HALF_SWORD_ENTRY,
      SPECIALIZED_WEAPON_ACTIONS.HALBERD_HOOK_AND_DRAW,
      SPECIALIZED_WEAPON_ACTIONS.PIKE_WITHDRAW_POINT,
    );
  }
  preferredIds.push(
    SPECIALIZED_WEAPON_ACTIONS.HALF_SWORD_ENTRY,
    SPECIALIZED_WEAPON_ACTIONS.GREATSWORD_BEAT_ASIDE,
    SPECIALIZED_WEAPON_ACTIONS.PIKE_SET_POINT,
    SPECIALIZED_WEAPON_ACTIONS.HALBERD_POINT_THRUST,
    SPECIALIZED_WEAPON_ACTIONS.HALBERD_HOOK_AND_DRAW,
    SPECIALIZED_WEAPON_ACTIONS.HALBERD_HEAVY_CHOP,
    SPECIALIZED_WEAPON_ACTIONS.PIKE_WITHDRAW_POINT,
    SPECIALIZED_WEAPON_ACTIONS.AXE_HOOK_GUARD,
    SPECIALIZED_WEAPON_ACTIONS.AXE_HEW_OPENING,
    SPECIALIZED_WEAPON_ACTIONS.MACE_CRUSH_ARMOR,
    SPECIALIZED_WEAPON_ACTIONS.MACE_BREAK_GUARD,
    SPECIALIZED_WEAPON_ACTIONS.DAGGER_GRAPPLE_POINT,
    SPECIALIZED_WEAPON_ACTIONS.DAGGER_CLOSE_THRUST,
    SPECIALIZED_WEAPON_ACTIONS.SHIELD_BIND_AND_STRIKE,
  );
  return preferredIds.map((id) => options.find((option) => option.id === id)).find(Boolean) || options[0];
};

export const applySpecializedWeaponActionToAttack = ({ attack, action } = {}) => {
  if (!attack || !action) return attack || null;
  return {
    ...attack,
    selectedTechnique: action.id,
    attackMode: action.id,
    specializedWeaponAction: action,
    specializedWeaponActionId: action.id,
    basicAttackStaminaCost: toFinite(action.staminaCost, 1),
    primaryDelivery:
      action.id === SPECIALIZED_WEAPON_ACTIONS.HALBERD_HEAVY_CHOP ||
      action.id === SPECIALIZED_WEAPON_ACTIONS.GREATSWORD_CUT_SHAFT ||
      action.id === SPECIALIZED_WEAPON_ACTIONS.AXE_HEW_OPENING
        ? "chop"
        : action.id === SPECIALIZED_WEAPON_ACTIONS.MACE_CRUSH_ARMOR ||
          action.id === SPECIALIZED_WEAPON_ACTIONS.MACE_BREAK_GUARD
          ? "blunt"
          : "thrust",
    halfSworded: action.id === SPECIALIZED_WEAPON_ACTIONS.HALF_SWORD_ENTRY,
    setPike: action.id === SPECIALIZED_WEAPON_ACTIONS.PIKE_SET_POINT,
  };
};

export const getSpecializedWeaponAttackModifier = ({
  actionId,
  attackerWeapon,
  defenderWeapon,
  distanceFt = 0,
  formationSupported = false,
} = {}) => {
  const action = getSpecializedWeaponActionProfile(actionId);
  if (!action) return { applies: false, modifier: 0, controlModifier: 0, reason: "no-specialized-action" };
  const attackerTraits = getCanonicalWeaponTraitProfile(attackerWeapon || {});
  const defenderTraits = getCanonicalWeaponTraitProfile(defenderWeapon || {});
  let modifier = toFinite(action.attackModifier);
  let controlModifier = toFinite(action.controlModifier);
  const reasons = [action.id];

  if (action.id === SPECIALIZED_WEAPON_ACTIONS.HALF_SWORD_ENTRY && defenderTraits.isPolearm) {
    modifier = Math.max(0, modifier);
    controlModifier += 1;
    reasons.push("half-sword-polearm-parity");
  }
  if (action.id === SPECIALIZED_WEAPON_ACTIONS.PIKE_SET_POINT && attackerTraits.isPike) {
    if (formationSupported) {
      modifier += 1;
      controlModifier += 2;
      reasons.push("formation-supported-pike");
    }
    if (toFinite(distanceFt) <= 5.5) {
      modifier -= 4;
      reasons.push("pike-point-collapsed");
    }
  }
  if (action.id === SPECIALIZED_WEAPON_ACTIONS.HALBERD_POINT_THRUST && toFinite(distanceFt) <= 5.5) {
    modifier -= 1;
    reasons.push("halberd-thrust-too-close");
  }
  if (action.id === SPECIALIZED_WEAPON_ACTIONS.HALBERD_HEAVY_CHOP && toFinite(distanceFt) > 5.5) {
    modifier -= 1;
    reasons.push("halberd-chop-outside-close-measure");
  }
  if (action.id === SPECIALIZED_WEAPON_ACTIONS.DAGGER_CLOSE_THRUST && toFinite(distanceFt) > 5.5) {
    modifier -= 3;
    reasons.push("dagger-outside-close-measure");
  }
  if (action.id === SPECIALIZED_WEAPON_ACTIONS.MACE_CRUSH_ARMOR && defenderTraits.family === "other") {
    reasons.push("armor-state-resolved-by-impact-pipeline");
  }
  const balance = getSpecializedWeaponBalanceAdjustment({ actionId: action.id });
  modifier += toFinite(balance.attack);
  controlModifier += toFinite(balance.control);
  reasons.push(...(balance.reasons || []));

  return { applies: true, modifier, controlModifier, action, reasons, balance };
};

const controlStateKey = (controllerId, targetId) => `${String(controllerId || "unknown")}::${String(targetId || "unknown")}`;

export const upsertPersistentWeaponControlState = (registry, state = {}) => {
  if (!(registry instanceof Map) || !state.controllerId || !state.targetId) return null;
  const key = controlStateKey(state.controllerId, state.targetId);
  const previous = registry.get(key) || {};
  const next = Object.freeze({
    ...previous,
    ...state,
    key,
    updatedAt: Date.now(),
    updatedRound: toFinite(state.currentRound ?? state.updatedRound, 0),
    expiresAfterRound: toFinite(state.expiresAfterRound, toFinite(state.currentRound, 0) + 2),
  });
  registry.set(key, next);
  return next;
};

export const reconcilePersistentWeaponControlStates = (registry, {
  combatants = [],
  positions = {},
  currentRound = 0,
  getWeapon,
  calculateDistanceFeet,
} = {}) => {
  if (!(registry instanceof Map)) return [];
  const actors = (Array.isArray(combatants) ? combatants : []).filter((actor) => actor?.id && positions?.[actor.id]);
  const activeIds = new Set(actors.map((actor) => actor.id));
  for (const [key, state] of registry.entries()) {
    if (
      !activeIds.has(state.controllerId) ||
      !activeIds.has(state.targetId) ||
      toFinite(state.expiresAfterRound, currentRound) < currentRound
    ) registry.delete(key);
  }

  for (const controller of actors) {
    const controllerSide = normalizeText(controller.team || controller.side || controller.type);
    const controllerWeapon = typeof getWeapon === "function" ? getWeapon(controller) : controller.selectedAttack;
    const controllerTraits = getWeaponTacticalTraits(controllerWeapon || {});
    if (controllerTraits.reachFeet <= 5.5) continue;
    for (const target of actors) {
      if (target.id === controller.id) continue;
      const targetSide = normalizeText(target.team || target.side || target.type);
      if (controllerSide && targetSide && controllerSide === targetSide) continue;
      const targetWeapon = typeof getWeapon === "function" ? getWeapon(target) : target.selectedAttack;
      const targetTraits = getWeaponTacticalTraits(targetWeapon || {});
      if (controllerTraits.reachFeet <= targetTraits.reachFeet + 0.1) continue;
      const controllerPosition = positions[controller.id];
      const targetPosition = positions[target.id];
      const dx = toFinite(controllerPosition.x) - toFinite(targetPosition.x);
      const dy = toFinite(controllerPosition.y) - toFinite(targetPosition.y);
      const approximateDistanceFt = typeof calculateDistanceFeet === "function"
        ? Math.max(0, toFinite(calculateDistanceFeet(controllerPosition, targetPosition), 0))
        : Math.max(Math.abs(dx), Math.abs(dy)) * 5;
      const measure = resolveWeaponEngagementMeasure({
        distanceFt: approximateDistanceFt,
        attackerWeapon: controllerWeapon,
        defenderWeapon: targetWeapon,
      });
      const relevant = approximateDistanceFt <= controllerTraits.reachFeet + 5.5;
      const key = controlStateKey(controller.id, target.id);
      if (!relevant) {
        registry.delete(key);
        continue;
      }
      upsertPersistentWeaponControlState(registry, {
        controllerId: controller.id,
        controllerName: controller.name || "Controller",
        targetId: target.id,
        targetName: target.name || "Target",
        controllerWeaponId: controllerWeapon?.id || controllerWeapon?.weaponId || controllerWeapon?.name || null,
        controllerWeaponName: controllerWeapon?.name || "Long weapon",
        reachFeet: controllerTraits.reachFeet,
        preferredDistanceFeet: controllerTraits.preferredDistanceFeet,
        pointControl: controllerTraits.pointControl,
        entryDenial: controllerTraits.entryDenial,
        measure,
        distanceFt: approximateDistanceFt,
        currentRound,
        expiresAfterRound: currentRound + 2,
        source: "geometry-reconciliation",
      });
    }
  }
  return [...registry.values()];
};

export const getPersistentWeaponControlStates = (registry) => (
  registry instanceof Map ? [...registry.values()] : []
);

export const buildWeaponMeasurePresentation = ({
  combatants = [],
  positions = {},
  selectedActorId = null,
  targetActorId = null,
  controlStates = [],
} = {}) => {
  const actorsById = new Map((Array.isArray(combatants) ? combatants : []).map((actor) => [actor.id, actor]));
  const focusIds = new Set([selectedActorId, targetActorId].filter(Boolean));
  const overlays = [];
  const threatLines = [];

  (Array.isArray(controlStates) ? controlStates : []).forEach((state) => {
    const controllerPosition = positions?.[state.controllerId];
    const targetPosition = positions?.[state.targetId];
    if (!controllerPosition || !targetPosition) return;
    const focused = focusIds.size === 0 || focusIds.has(state.controllerId) || focusIds.has(state.targetId);
    if (!focused && threatLines.length >= 10) return;
    threatLines.push({
      id: state.key || controlStateKey(state.controllerId, state.targetId),
      controllerId: state.controllerId,
      targetId: state.targetId,
      from: controllerPosition,
      to: targetPosition,
      measure: state.measure,
      distanceFt: state.distanceFt,
      label: `${state.controllerWeaponName || "Long weapon"}: ${state.measure || "measure"}`,
      focused,
    });
  });

  focusIds.forEach((actorId) => {
    const actor = actorsById.get(actorId);
    const position = positions?.[actorId];
    if (!actor || !position) return;
    const states = (Array.isArray(controlStates) ? controlStates : []).filter((state) => state.controllerId === actorId);
    const largest = states.sort((left, right) => toFinite(right.reachFeet) - toFinite(left.reachFeet))[0];
    if (!largest) return;
    overlays.push({
      id: `measure:${actorId}`,
      actorId,
      position,
      radiusFeet: Math.max(5, toFinite(largest.preferredDistanceFeet, largest.reachFeet || 5)),
      label: `${largest.controllerWeaponName || "Weapon"} measure`,
      measure: largest.measure,
    });
  });

  return { overlays, threatLines };
};

export const formatWeaponEntryExchangeNarration = ({ mover, controller, result } = {}) => {
  if (!result) return "The weapon-entry exchange cannot be resolved.";
  const moverName = mover?.name || "The shorter-weapon fighter";
  const controllerName = controller?.name || "The long-weapon fighter";
  const entryLabel = result.entryTechnique?.label || "Entry";
  const responseLabel = result.controlResponse?.label || "Point control";
  const scoreText = `${result.entryScore ?? "?"} against ${result.controlScore ?? "?"}`;
  return result.allowed
    ? `${moverName} uses ${entryLabel} against ${controllerName}'s ${responseLabel} (${scoreText}) and crosses the point.`
    : `${controllerName} answers ${moverName}'s ${entryLabel} with ${responseLabel} (${scoreText}) and denies the entry.`;
};

export const formatSpecializedWeaponActionNarration = ({ actor, target, action } = {}) => (
  `${actor?.name || "The fighter"} chooses ${action?.label || "a specialized weapon action"}` +
  `${target?.name ? ` against ${target.name}` : ""}.`
);

export const resolveSpecializedWeaponEffectOnHit = ({
  actionId,
  attacker,
  defender,
  currentRound = 0,
} = {}) => {
  const action = getSpecializedWeaponActionProfile(actionId);
  if (!action) return { applied: false, effect: null };

  if (action.id === SPECIALIZED_WEAPON_ACTIONS.HALBERD_HOOK_AND_DRAW) {
    const existing = Array.isArray(defender?.statusEffects) ? defender.statusEffects : [];
    const status = createWeaponCondition({
      type: WEAPON_CONDITION_TYPES.OFF_BALANCE,
      source: action.id,
      sourceActorId: attacker?.id || null,
      targetActorId: defender?.id || null,
      currentRound,
      durationRounds: 1,
      penalties: { defense: -1, entry: -1 },
    });
    return {
      applied: true,
      effect: "halberd-hook-off-balance",
      action,
      defenderPatch: {
        statusEffects: [...existing.filter((entry) => entry?.type !== "off-balance"), status],
        weaponControlDisruptedBy: attacker?.id || null,
      },
      continueDamage: true,
    };
  }

  if ([SPECIALIZED_WEAPON_ACTIONS.AXE_HOOK_GUARD, SPECIALIZED_WEAPON_ACTIONS.MACE_BREAK_GUARD, SPECIALIZED_WEAPON_ACTIONS.SHIELD_BIND_AND_STRIKE].includes(action.id)) {
    const existing = Array.isArray(defender?.statusEffects) ? defender.statusEffects : [];
    const type = action.id === SPECIALIZED_WEAPON_ACTIONS.AXE_HOOK_GUARD
      ? WEAPON_CONDITION_TYPES.OFF_BALANCE
      : action.id === SPECIALIZED_WEAPON_ACTIONS.SHIELD_BIND_AND_STRIKE
        ? WEAPON_CONDITION_TYPES.SHIELD_BOUND
        : WEAPON_CONDITION_TYPES.GUARD_DISRUPTED;
    const status = createWeaponCondition({
      type,
      source: action.id,
      sourceActorId: attacker?.id || null,
      targetActorId: defender?.id || null,
      currentRound,
      durationRounds: 1,
    });
    return {
      applied: true,
      effect: action.effect,
      action,
      defenderPatch: {
        statusEffects: [...existing.filter((entry) => normalizeText(entry?.type) !== normalizeText(type)), status],
      },
      continueDamage: true,
    };
  }

  if ([SPECIALIZED_WEAPON_ACTIONS.MACE_CRUSH_ARMOR, SPECIALIZED_WEAPON_ACTIONS.AXE_HEW_OPENING, SPECIALIZED_WEAPON_ACTIONS.DAGGER_CLOSE_THRUST, SPECIALIZED_WEAPON_ACTIONS.DAGGER_GRAPPLE_POINT].includes(action.id)) {
    return {
      applied: true,
      effect: action.effect,
      action,
      continueDamage: true,
    };
  }

  if (action.id === SPECIALIZED_WEAPON_ACTIONS.PIKE_SET_POINT) {
    return {
      applied: true,
      effect: "pike-point-set",
      action,
      attackerPatch: {
        weaponControlMode: {
          mode: "set-pike",
          targetId: defender?.id || null,
          appliedRound: currentRound,
          expiresRound: currentRound + 1,
        },
      },
      continueDamage: true,
    };
  }

  if (action.id === SPECIALIZED_WEAPON_ACTIONS.HALF_SWORD_ENTRY) {
    return {
      applied: true,
      effect: "half-sword-control-established",
      action,
      attackerPatch: {
        halfSwordControlByTarget: {
          ...(attacker?.halfSwordControlByTarget || {}),
          [defender?.id || "unknown"]: {
            appliedRound: currentRound,
            expiresRound: currentRound + 1,
          },
        },
      },
      continueDamage: true,
    };
  }

  return { applied: false, effect: null, action };
};

export const getPersistentSupportingControllers = (registry, {
  targetId,
  excludeControllerId = null,
  combatants = [],
} = {}) => {
  if (!(registry instanceof Map) || !targetId) return [];
  const actorsById = new Map((Array.isArray(combatants) ? combatants : []).map((actor) => [actor?.id, actor]));
  const allowedMeasures = new Set([
    WEAPON_ENGAGEMENT_MEASURES.LONG_WEAPON,
    WEAPON_ENGAGEMENT_MEASURES.ENTRY_CONTESTED,
    "supporting-long-weapon-control",
  ]);
  const seen = new Set();
  const controllers = [];
  for (const state of registry.values()) {
    if (state?.targetId !== targetId || state?.controllerId === excludeControllerId) continue;
    if (!allowedMeasures.has(state?.measure)) continue;
    const actor = actorsById.get(state.controllerId);
    if (!actor || seen.has(actor.id)) continue;
    seen.add(actor.id);
    controllers.push(actor);
  }
  return controllers.slice(0, 3);
};
