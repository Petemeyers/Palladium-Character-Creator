import { validateAttackRange } from "./combatRangeValidation.js";
import {
  formatRangeModifier,
  getRangedAttackRangeModifier,
} from "./rangedAttackRangeModifier.js";
import {
  getMeleeEngagementContext,
  isAttackUsableInClinch,
  isChargeOnlyAttack,
} from "./meleeEngagementContext.js";
import { MOUNTED_ACTION_CONTRACTS } from "./combat/canonicalMountedCombat.js";
import { MOUNTED_FLIGHT_ACTION_CONTRACTS } from "./combat/canonicalMountedFlight.js";
import { HUNTING_ACTION_CONTRACTS } from "./combat/canonicalHuntingEncounter.js";
import { CONCEALMENT_ACTIONS } from "./combat/liveWildlifeConcealmentRanged.js";
import { CARCASS_PROCESSING_ACTIONS } from "./combat/canonicalCarcassProcessing.js";

const hasValue = (value) => value !== undefined && value !== null && value !== "";

const toNumber = (value) => {
  if (value === undefined || value === null || value === "" || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const normalizeText = (value, fallback = "") => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
};

const normalizeId = (value, fallback) =>
  normalizeText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;

const getEntryId = (entry, index = 0) =>
  String(entry?.id || entry?._id || entry?.name || entry?.label || index);

const selectedTargetId = (selectedTarget) => {
  if (!selectedTarget) return "";
  if (typeof selectedTarget === "string" || typeof selectedTarget === "number") return String(selectedTarget);
  return String(selectedTarget.id || selectedTarget._id || selectedTarget.name || "");
};

const getRemainingActions = (actor, currentTurnEntry) => {
  const value =
    toNumber(currentTurnEntry?.remainingActions) ??
    toNumber(actor?.remainingActions) ??
    toNumber(actor?.actionsRemaining);
  return value;
};

const getCurrentStamina = (actor, currentTurnEntry) => {
  const value =
    toNumber(currentTurnEntry?.currentStamina) ??
    toNumber(actor?.currentStamina) ??
    toNumber(actor?.staminaState?.currentStamina) ??
    toNumber(actor?.fatigueState?.currentStamina);
  return value;
};

const parseFeet = (value) => {
  const number = toNumber(value);
  if (number !== null) return number;
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : null;
};

const formatBonus = (value) => {
  if (!hasValue(value)) return "";
  const text = String(value);
  if (text.startsWith("+") || text.startsWith("-")) return text;
  const number = toNumber(value);
  if (number === null) return text;
  return number >= 0 ? `+${number}` : String(number);
};

const sanitizeMetadata = (metadata = {}) =>
  Object.entries(metadata || {}).reduce((safe, [key, value]) => {
    if (!hasValue(value) || typeof value === "function") return safe;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      safe[key] = value;
    }
    return safe;
  }, {});

const ACTION_CONTRACTS = Object.freeze({
  attack: { rollRequired: true, executorIdentity: "canonical-attack-dispatcher", aiAvailable: true },
  move: { rollRequired: false, executorIdentity: "canonical-movement-dispatcher", aiAvailable: true },
  run: { rollRequired: false, executorIdentity: "canonical-movement-dispatcher", aiAvailable: true },
  charge: { rollRequired: false, executorIdentity: "canonical-movement-dispatcher", aiAvailable: true },
  defend: { rollRequired: false, executorIdentity: "defend-action-handler", aiAvailable: true },
  block: { rollRequired: false, executorIdentity: "block-action-handler", aiAvailable: true },
  evade: { rollRequired: false, executorIdentity: "evade-action-handler", aiAvailable: true },
  recover: { rollRequired: false, executorIdentity: "recover-action-handler", aiAvailable: true },
  "use-item": { rollRequired: false, executorIdentity: "use-item-action-handler", aiAvailable: false },
  "use-skill": { rollRequired: false, executorIdentity: "use-skill-action-handler", aiAvailable: true },
  grapple: { rollRequired: true, executorIdentity: "canonical-grapple-executor", aiAvailable: true },
  "ground-control": { rollRequired: false, executorIdentity: "canonical-grapple-executor", aiAvailable: true },
  surrender: { rollRequired: false, executorIdentity: "canonical-surrender-lifecycle", aiAvailable: true },
  projectile: { rollRequired: true, executorIdentity: "canonical-ranged-dispatcher", aiAvailable: true },
  "extended-melee": { rollRequired: true, executorIdentity: "canonical-attack-dispatcher", aiAvailable: true },
  reload: { rollRequired: false, executorIdentity: "canonical-ranged-reload", aiAvailable: true },
  draw: { rollRequired: false, executorIdentity: "canonical-weapon-transition", aiAvailable: true },
  mount: { rollRequired: false, executorIdentity: "canonical-carrier-executor", aiAvailable: true },
  dismount: { rollRequired: false, executorIdentity: "canonical-carrier-executor", aiAvailable: true },
  "emergency-dismount": { rollRequired: false, executorIdentity: "canonical-carrier-executor", aiAvailable: false },
  "control-mount": { rollRequired: "pressure-only", executorIdentity: "canonical-mounted-executor", aiAvailable: true },
  "mounted-walk": { rollRequired: false, executorIdentity: "canonical-mounted-executor", aiAvailable: true },
  "mounted-run": { rollRequired: false, executorIdentity: "canonical-mounted-executor", aiAvailable: true },
  "mounted-charge": { rollRequired: true, executorIdentity: "canonical-mounted-executor", aiAvailable: true },
  "mounted-rider-strike": { rollRequired: true, executorIdentity: "canonical-mounted-executor", aiAvailable: true },
  "mounted-rider-ranged-attack": { rollRequired: true, executorIdentity: "canonical-mounted-executor", aiAvailable: true },
  "mount-natural-attack": { rollRequired: true, executorIdentity: "canonical-mounted-executor", aiAvailable: true },
  "brace-against-charge": { rollRequired: false, executorIdentity: "canonical-mounted-executor", aiAvailable: true },
  "recover-mounted-control": { rollRequired: true, executorIdentity: "canonical-mounted-executor", aiAvailable: true },
  "flying-mount-takeoff": { rollRequired: false, executorIdentity: "canonical-mounted-flight-executor", aiAvailable: true },
  "flying-mount-ascend": { rollRequired: false, executorIdentity: "canonical-mounted-flight-executor", aiAvailable: true },
  "flying-mount-descend": { rollRequired: false, executorIdentity: "canonical-mounted-flight-executor", aiAvailable: true },
  "mounted-flight-move": { rollRequired: false, executorIdentity: "canonical-mounted-flight-executor", aiAvailable: true },
  "flying-mount-land": { rollRequired: false, executorIdentity: "canonical-mounted-flight-executor", aiAvailable: true },
  "secure-seat": { rollRequired: false, executorIdentity: "canonical-mounted-flight-executor", aiAvailable: true },
  "release-from-flying-mount": { rollRequired: false, executorIdentity: "canonical-mounted-flight-executor", aiAvailable: true },
  "emergency-aerial-separation": { rollRequired: false, executorIdentity: "canonical-mounted-flight-executor", aiAvailable: false },
  "mounted-aerial-rider-ranged-attack": { rollRequired: true, executorIdentity: "canonical-mounted-flight-executor", aiAvailable: true },
  "mounted-aerial-rider-melee-attack": { rollRequired: true, executorIdentity: "canonical-mounted-flight-executor", aiAvailable: true },
  "flying-mount-natural-attack": { rollRequired: true, executorIdentity: "canonical-mounted-flight-executor", aiAvailable: true },
  "command-intelligent-mount": { rollRequired: false, executorIdentity: "canonical-mounted-flight-executor", aiAvailable: true },
  "recover-mounted-flight-control": { rollRequired: true, executorIdentity: "canonical-mounted-flight-executor", aiAvailable: true },
  "search-for-sign": { rollRequired: "caller-authoritative", executorIdentity: "canonical-hunting-executor", aiAvailable: true },
  "examine-tracks": { rollRequired: "caller-authoritative", executorIdentity: "canonical-hunting-executor", aiAvailable: true },
  "follow-trail": { rollRequired: "caller-authoritative", executorIdentity: "canonical-hunting-executor", aiAvailable: true },
  stalk: { rollRequired: "caller-authoritative", executorIdentity: "canonical-hunting-executor", aiAvailable: true },
  "wait-in-cover": { rollRequired: false, executorIdentity: "canonical-hunting-executor", aiAvailable: true },
  "scan-terrain": { rollRequired: "caller-authoritative", executorIdentity: "canonical-hunting-executor", aiAvailable: true },
  listen: { rollRequired: "caller-authoritative", executorIdentity: "canonical-hunting-executor", aiAvailable: true },
  "take-hunting-shot": { rollRequired: true, executorIdentity: "canonical-ranged-dispatcher", aiAvailable: true },
  "begin-pursuit": { rollRequired: false, executorIdentity: "canonical-hunting-executor", aiAvailable: true },
  "follow-blood-trail": { rollRequired: "caller-authoritative", executorIdentity: "canonical-hunting-executor", aiAvailable: true },
  "abandon-hunt": { rollRequired: false, executorIdentity: "canonical-hunting-executor", aiAvailable: true },
  "recover-quarry": { rollRequired: false, executorIdentity: "canonical-hunting-executor", aiAvailable: true },
  "field-dress-carcass": { rollRequired: "uncertainty-only", executorIdentity: "canonical-carcass-processing", aiAvailable: true },
  "issue-companion-command": { rollRequired: "pressure-only", executorIdentity: "canonical-companion-executor", aiAvailable: true },
  hide: { rollRequired: true, executorIdentity: "canonical-concealment-executor", aiAvailable: true },
  sneak: { rollRequired: false, executorIdentity: "canonical-concealment-executor", aiAvailable: true },
  aim: { rollRequired: false, executorIdentity: "canonical-ranged-aim", aiAvailable: true },
  compatibility: { rollRequired: false, executorIdentity: "compatibility-controls-panel", aiAvailable: false },
});

export const getCombatActionContract = (type, source = "") => {
  const normalizedType = normalizeText(type, "compatibility");
  const contract = ACTION_CONTRACTS[normalizedType] || ACTION_CONTRACTS.compatibility;
  const mountedContract = MOUNTED_ACTION_CONTRACTS[normalizedType] || null;
  const mountedFlightContract = MOUNTED_FLIGHT_ACTION_CONTRACTS[normalizedType] || null;
  const huntingContract = HUNTING_ACTION_CONTRACTS[normalizedType] || null;
  const processingContract = CARCASS_PROCESSING_ACTIONS[normalizedType] || null;
  const compatibility = normalizeText(source).toLowerCase().includes("compatibility");
  return {
    ...contract,
    ...((mountedFlightContract || mountedContract) ? {
      stableKey: (mountedFlightContract || mountedContract).key,
      actionOwner: (mountedFlightContract || mountedContract).owner,
      staminaOwner: (mountedFlightContract || mountedContract).staminaOwner,
      prerequisites: (mountedFlightContract || mountedContract).prerequisites,
      legalRiderStates: (mountedFlightContract || mountedContract).legalRiderStates,
      legalMountStates: (mountedFlightContract || mountedContract).legalMountStates,
      mountedExecutor: (mountedFlightContract || mountedContract).executor,
    } : {}),
    ...(huntingContract ? {
      stableKey: huntingContract.key,
      actionOwner: "hunter",
      staminaOwner: huntingContract.staminaOwner,
      legalPhases: huntingContract.legalPhases,
      huntingExecutor: huntingContract.executor,
      deferred: huntingContract.deferred,
    } : {}),
    ...(processingContract ? {
      stableKey: processingContract.key,
      executorIdentity: "canonical-carcass-processing",
      aiAvailable: processingContract.aiAvailable,
      rollRequired: processingContract.rollBehavior,
      actionOwner: processingContract.owner,
      legalRecoveryStates: processingContract.legalRecoveryStates,
      legalProcessingStates: processingContract.legalProcessingStates,
      processingExecutor: processingContract.executor,
      toolCapability: processingContract.toolCapability,
      inventoryTransferBehavior: processingContract.inventoryTransferBehavior,
    } : {}),
    playerVisible: !compatibility,
    turnEnding: MOUNTED_FLIGHT_ACTION_CONTRACTS[normalizedType]?.turnEnding
      ?? MOUNTED_ACTION_CONTRACTS[normalizedType]?.turnEnding
      ?? ["mount", "dismount", "emergency-dismount"].includes(normalizedType),
    legalActorStates: ["active", "conscious"],
  };
};

const getDisabledReason = ({ enabled, disabledReason, costActions, costStamina, targetRequired, targetId, actor, currentTurnEntry }) => {
  if (enabled === false && disabledReason) return disabledReason;
  const remainingActions = getRemainingActions(actor, currentTurnEntry);
  if (toNumber(costActions) > 0 && remainingActions !== null && remainingActions <= 0) {
    return "No actions remaining.";
  }
  const currentStamina = getCurrentStamina(actor, currentTurnEntry);
  if (toNumber(costStamina) > 0 && currentStamina !== null && currentStamina <= 0) {
    return "No stamina remaining.";
  }
  if (targetRequired && !targetId) return "Select a target.";
  return "";
};

const makeAction = ({
  actor,
  currentTurnEntry,
  id,
  name,
  type,
  source,
  category,
  costActions = 0,
  costStamina = 0,
  targetRequired = false,
  targetId = "",
  reachFt = null,
  rangeFt = null,
  enabled = true,
  disabledReason = "",
  previewSummary = "",
  metadata = {},
}) => {
  const reason = getDisabledReason({
    enabled,
    disabledReason,
    costActions,
    costStamina,
    targetRequired,
    targetId,
    actor,
    currentTurnEntry,
  });

  const stableId = normalizeId(id, normalizeId(name, "action"));
  const contract = getCombatActionContract(type, source);
  return {
    id: stableId,
    actionKey: stableId,
    name: normalizeText(name, "Unnamed action"),
    displayLabel: normalizeText(name, "Unnamed action"),
    type: normalizeText(type, "compatibility"),
    source: normalizeText(source, "catalog"),
    category: normalizeText(category, "General"),
    costActions: toNumber(costActions) ?? 0,
    costStamina: toNumber(costStamina) ?? 0,
    targetRequired: Boolean(targetRequired),
    targetId: targetId ? String(targetId) : "",
    reachFt: toNumber(reachFt),
    rangeFt: toNumber(rangeFt),
    enabled: !reason,
    disabledReason: reason,
    previewSummary: normalizeText(previewSummary, ""),
    metadata: sanitizeMetadata(metadata),
    ...contract,
  };
};

const getActorAttackPreviews = (actor = {}) => [
  ...toArray(actor.publicAttackPreviews),
  ...toArray(actor.autoRollCharacter?.publicAttackPreviews),
  ...toArray(actor.publicEnemyMetadata?.actions),
  ...toArray(actor.actions),
  ...toArray(actor.attacks),
];

const getWeaponCandidates = ({ actor = {}, equippedWeapons = [] }) => [
  ...toArray(equippedWeapons),
  ...toArray(actor.equippedWeapons),
  ...toArray(actor.equistaminadWeapons),
  actor.equipment?.rightHand,
  actor.equipment?.leftHand,
  actor.equipment?.weaponPrimary,
  actor.equipment?.weaponSecondary,
  actor.equistaminad?.weaponPrimary,
  actor.equistaminad?.weaponSecondary,
].filter(Boolean);

const getInventoryCandidates = ({ actor = {}, inventory = [] }) => [
  ...toArray(inventory),
  ...toArray(actor.inventory),
  ...toArray(actor.items),
];

const skillCandidateFromEntry = (entry, source, index) => {
  if (!entry || typeof entry === "function") return null;
  if (typeof entry === "string" || typeof entry === "number") {
    const name = normalizeText(entry, "");
    return name ? { id: "", name, category: "", source, index } : null;
  }
  if (Array.isArray(entry)) {
    const [name, data] = entry;
    const skillName = normalizeText(name, "");
    if (!skillName) return null;
    return {
      id: normalizeText(data?.id || data?._id || data?.skillId, ""),
      name: skillName,
      category: normalizeText(data?.category || data?.type, ""),
      source,
      index,
    };
  }
  if (typeof entry === "object") {
    const name = normalizeText(entry.name || entry.label || entry.skillName || entry.type, "");
    if (!name) return null;
    return {
      id: normalizeText(entry.id || entry._id || entry.skillId, ""),
      name,
      category: normalizeText(entry.category || entry.type, ""),
      source: normalizeText(entry.source || entry.origin, source),
      index,
    };
  }
  return null;
};

const getSkillCandidates = ({ actor = {} }) => [
  ...toArray(actor.skills).map((entry, index) => skillCandidateFromEntry(entry, "skills", index)),
  ...Object.entries(actor.professionSkills || {}).map((entry, index) => skillCandidateFromEntry(entry, "profession skills", index)),
  ...toArray(actor.electiveSkills).map((entry, index) => skillCandidateFromEntry(entry, "elective skills", index)),
  ...toArray(actor.autoRollCharacter?.skills).map((entry, index) => skillCandidateFromEntry(entry, "public skills", index)),
  ...Object.entries(actor.autoRollCharacter?.professionSkills || {}).map((entry, index) => skillCandidateFromEntry(entry, "public profession skills", index)),
].filter(Boolean);

const isUnarmedWeapon = (weapon) => {
  const name = normalizeText(weapon?.name || weapon?.label, "").toLowerCase();
  return !name || name === "unarmed" || name === "unarmed strike";
};

const buildAttackSummary = (entry = {}) => {
  const hit = formatBonus(entry.hitBonus ?? entry.attackBonus ?? entry.toHit);
  const damage = normalizeText(entry.damageExpression || entry.damage || entry.damageDice || entry.damageDie, "");
  const damageType = normalizeText(entry.damageType, "");
  const reach = normalizeText(entry.reach || entry.reachFt, "");
  const range = normalizeText(entry.range || entry.rangeFt, "");
  return [
    hit ? `${hit} hit` : "",
    damage ? `${damage}${damageType ? ` ${damageType}` : ""}` : "",
    reach ? `reach ${reach}` : "",
    range ? `range ${range}` : "",
  ].filter(Boolean).join(", ");
};

const buildAttackAction = ({ actor, currentTurnEntry, entry, index, targetId, selectedTarget, source }) => {
  const name = normalizeText(entry.name || entry.label || entry.attackName, "Unnamed attack");
  const slot = normalizeText(entry.slot || entry.hand || entry.position, "");
  const actionName = source === "equipped weapon" && slot
    ? `Attack with ${name} (${slot})`
    : `Attack with ${name}`;
  const reachFt = parseFeet(entry.reachFt ?? entry.reach);
  const rangeFt = parseFeet(entry.rangeFt ?? entry.range);
  const rangeValidation = validateAttackRange({ attacker: actor, target: selectedTarget, attack: entry });
  const rangedRangeModifier = getRangedAttackRangeModifier({
    actor,
    attack: entry,
    distanceFt: rangeValidation.distanceFt,
    adjacentHostile: Number(rangeValidation.distanceFt) <= 5,
  });
  const outOfRange = rangeValidation.inRange === false;
  const engagement = getMeleeEngagementContext({
    actor,
    target: selectedTarget,
    distanceFeet: rangeValidation.distanceFt,
  });
  const inClinch = engagement.isClinched || engagement.isGrappling || engagement.isGround;
  const blockedInClinch = inClinch && !isAttackUsableInClinch(entry);
  const chargeBlockedAtCloseRange = engagement.isAdjacent && isChargeOnlyAttack(entry);
  const engagementBlockedReason = blockedInClinch
    ? `${name} cannot be used effectively in the clinch.`
    : chargeBlockedAtCloseRange
      ? `${name} requires open melee and cannot be used at adjacent range.`
      : "";
  const rangeSummary = rangeValidation.message && rangeValidation.message !== "Range unknown."
    ? rangeValidation.message
    : "";
  return makeAction({
    actor,
    currentTurnEntry,
    id: `${source}-${name}-${slot || index}`,
    name: actionName,
    type: "attack",
    source,
    category: "Attack",
    costActions: 1,
    costStamina: 1,
    targetRequired: true,
    targetId,
    reachFt,
    rangeFt,
    enabled: !outOfRange && !engagementBlockedReason,
    disabledReason: outOfRange ? rangeValidation.message : engagementBlockedReason,
    previewSummary: [
      buildAttackSummary(entry) || "Attack preview pending.",
      rangedRangeModifier.isRanged && rangedRangeModifier.maxRangeFt !== null
        ? `${rangedRangeModifier.distanceFt ?? "?"} / ${rangedRangeModifier.maxRangeFt} ft - ${rangedRangeModifier.bandLabel}; modifier ${formatRangeModifier(rangedRangeModifier.finalModifier)}`
        : rangeValidation.rangeType === "melee" && rangeValidation.distanceFt !== null
          ? `${rangeValidation.distanceFt} / ${rangeValidation.reachFt ?? "?"} ft - ${outOfRange ? "Out of melee range" : "Melee"}`
          : "",
      rangeSummary,
      engagementBlockedReason,
    ].filter(Boolean).join(" "),
    metadata: {
      attackName: name,
      attackType: entry.attackType || entry.type,
      damageType: entry.damageType,
      slot,
      distanceFt: rangeValidation.distanceFt,
      rangeType: rangeValidation.rangeType,
      rangeMessage: rangeValidation.message,
      suggestedAction: rangeValidation.suggestedAction,
      rangeBand: rangedRangeModifier.band,
      rangeModifier: rangedRangeModifier.finalModifier,
      meleeRangeBand: engagement.rangeBand,
    },
  });
};

const buildUnarmedAction = ({ actor, currentTurnEntry, targetId, selectedTarget }) => {
  const unarmedAttack = { name: "Unarmed Strike", attackType: "close", reachFt: 5 };
  const rangeValidation = validateAttackRange({ attacker: actor, target: selectedTarget, attack: unarmedAttack });
  const outOfRange = rangeValidation.inRange === false;
  return makeAction({
    actor,
    currentTurnEntry,
    id: "unarmed-strike",
    name: "Unarmed Strike",
    type: "attack",
    source: "unarmed fallback",
    category: "Attack",
    costActions: 1,
    costStamina: 1,
    targetRequired: true,
    targetId,
    reachFt: 5,
    enabled: !outOfRange,
    disabledReason: outOfRange ? rangeValidation.message : "",
    previewSummary: [
      "Basic close attack, reach 5 ft.",
      outOfRange ? rangeValidation.message : "",
    ].filter(Boolean).join(" "),
    metadata: {
      attackName: "Unarmed Strike",
      attackType: "close",
      distanceFt: rangeValidation.distanceFt,
      rangeType: rangeValidation.rangeType,
      rangeMessage: rangeValidation.message,
      suggestedAction: rangeValidation.suggestedAction,
    },
  });
};

const addUnique = (actions, action) => {
  if (!action) return;
  if (actions.some((existing) => existing.id === action.id || existing.name === action.name)) return;
  actions.push(action);
};

const buildMovementActions = ({ actor, currentTurnEntry, targetId }) => [
  makeAction({
    actor,
    currentTurnEntry,
    id: "move",
    name: "Walk",
    type: "move",
    source: "movement",
    category: "Movement",
    costActions: 1,
    costStamina: 0,
    previewSummary: "Standard walking movement command.",
  }),
  makeAction({
    actor,
    currentTurnEntry,
    id: "run",
    name: "Run",
    type: "run",
    source: "movement",
    category: "Movement",
    costActions: 1,
    costStamina: 1,
    previewSummary: "Fast movement command.",
  }),
  makeAction({
    actor,
    currentTurnEntry,
    id: "charge",
    name: "Charge",
    type: "charge",
    source: "movement",
    category: "Movement",
    costActions: 1,
    costStamina: 1,
    targetRequired: true,
    targetId,
    previewSummary: "Fast advance; attack follow-through pending.",
  }),
];

const buildDefensiveRecoveryActions = ({ actor, currentTurnEntry }) => [
  makeAction({
    actor,
    currentTurnEntry,
    id: "defend",
    name: "Defend",
    type: "defend",
    source: "manual catalog",
    category: "Defense",
    costActions: 1,
    previewSummary: "Enter defensive posture until this combatant's next turn.",
  }),
  makeAction({
    actor,
    currentTurnEntry,
    id: "block",
    name: "Block",
    type: "block",
    source: "manual catalog",
    category: "Defense",
    costActions: 1,
    previewSummary: "Enter blocking posture until this combatant's next turn.",
  }),
  makeAction({
    actor,
    currentTurnEntry,
    id: "evade",
    name: "Evade",
    type: "evade",
    source: "manual catalog",
    category: "Defense",
    costActions: 1,
    previewSummary: "Enter evading posture until this combatant's next turn.",
  }),
  makeAction({
    actor,
    currentTurnEntry,
    id: "recover",
    name: "Catch Breath / Recover",
    type: "recover",
    source: "manual catalog",
    category: "Recovery",
    costActions: 1,
    previewSummary: "Restore 3 stamina.",
    metadata: {
      recoveryAmount: 3,
    },
  }),
];

const buildCarrierActions = ({
  actor,
  currentTurnEntry,
  selectedTarget,
  carrierContext = {},
}) => {
  const activeLink = carrierContext.activeLink || actor?.carrierLink || null;
  const actorId = getEntryId(actor);
  const selectedCarrierSupportsMount = selectedTarget?.carrierProfile?.allowedRelationshipTypes?.includes?.("mounted") === true
    && selectedTarget?.mountProfile?.mayServeAsMount === true
    && actor?.riderProfile?.mayRide === true;
  const selectedCarrierSupportsFlyingMount = selectedTarget?.carrierProfile?.allowedRelationshipTypes?.includes?.("flying-mounted") === true
    && selectedTarget?.flyingMountProfile?.mayServeAsFlyingMount === true
    && actor?.riderProfile?.mayRide === true;
  const actorIsMountedPassenger = ["mounted", "flying-mounted"].includes(activeLink?.relationshipType)
    && String(activeLink.passengerId) === actorId
    && !["released", "broken"].includes(activeLink.state);
  const actions = [];
  if (!activeLink && (selectedCarrierSupportsMount || selectedCarrierSupportsFlyingMount)) {
    const relationshipType = selectedCarrierSupportsFlyingMount ? "flying-mounted" : "mounted";
    actions.push(makeAction({
      actor,
      currentTurnEntry,
      id: "mount",
      name: "Mount",
      type: "mount",
      source: "canonical carrier catalog",
      category: "Carrier",
      costActions: 1,
      targetRequired: true,
      targetId: selectedTargetId(selectedTarget),
      previewSummary: "Establish the canonical mounted carrier link.",
      metadata: {
        executor: "establishCanonicalCarrierLink",
        relationshipType,
        legalRelationshipState: "none",
      },
    }));
  }
  if (!activeLink) {
    const braceWeapon = (actor.weaponProfiles || actor.attacks || []).find((weapon) => /spear|pike|polearm|halberd/i.test(weapon?.name || ""));
    if (braceWeapon) {
      const contract = MOUNTED_ACTION_CONTRACTS["brace-against-charge"];
      actions.push(makeAction({
        actor,
        currentTurnEntry,
        id: contract.key,
        name: contract.label,
        type: contract.key,
        source: "canonical mounted catalog",
        category: contract.category,
        costActions: contract.actionCost,
        previewSummary: "Prepare the equipped reach weapon against an authorized charge.",
        metadata: {
          executor: contract.executor,
          actionOwner: contract.owner,
          staminaOwner: contract.staminaOwner,
          weaponId: braceWeapon.profileKey || braceWeapon.id,
        },
      }));
    }
  }
  if (actorIsMountedPassenger) {
    if (activeLink.relationshipType === "flying-mounted") {
      const mountedTurn = carrierContext.mountedTurn || carrierContext.mountedFlightTurn || null;
      const mount = carrierContext.mount || null;
      const flightState = activeLink.mountedFlightState?.state || "grounded-mounted";
      const riderWeapons = actor.weaponProfiles || actor.attacks || [];
      const meleeWeapon = riderWeapons.find((weapon) => !["projectile", "ranged"].includes(normalizeText(weapon.deliveryType || weapon.kind).toLowerCase()));
      const rangedWeapon = riderWeapons.find((weapon) => ["projectile", "ranged"].includes(normalizeText(weapon.deliveryType || weapon.kind).toLowerCase()));
      const mountNaturalAttack = mount?.naturalAttackProfiles?.[0] || mount?.weaponProfiles?.find((profile) => profile.naturalWeapon === true) || null;
      const keys = [
        ...(flightState === "grounded-mounted" || flightState === "perched" ? ["flying-mount-takeoff", "release-from-flying-mount"] : []),
        ...(["airborne", "ascending", "descending"].includes(flightState) ? ["flying-mount-ascend", "flying-mount-descend", "mounted-flight-move", "flying-mount-land", "emergency-aerial-separation"] : []),
        ...(rangedWeapon && flightState !== "grounded-mounted" ? ["mounted-aerial-rider-ranged-attack"] : []),
        ...(meleeWeapon && flightState !== "grounded-mounted" ? ["mounted-aerial-rider-melee-attack"] : []),
        ...(mountNaturalAttack && flightState !== "grounded-mounted" ? ["flying-mount-natural-attack"] : []),
        ...(["loose", "failing", "bareback"].includes(activeLink.mountedFlightState?.attachmentState) ? ["secure-seat"] : []),
        ...(activeLink.controlType === "independent-intelligent-mount" ? ["command-intelligent-mount"] : []),
        ...(flightState === "out-of-control" ? ["recover-mounted-flight-control"] : []),
      ];
      keys.forEach((key) => {
        const flightContract = MOUNTED_FLIGHT_ACTION_CONTRACTS[key];
        const ownerActions = flightContract.owner === "mount"
          ? mountedTurn?.mountActionsRemaining
          : flightContract.owner === "rider"
            ? mountedTurn?.riderActionsRemaining
            : Math.min(mountedTurn?.riderActionsRemaining ?? 0, mountedTurn?.mountActionsRemaining ?? 0);
        const attackId = key === "flying-mount-natural-attack"
          ? mountNaturalAttack?.profileKey || mountNaturalAttack?.attackKey
          : key === "mounted-aerial-rider-ranged-attack"
            ? rangedWeapon?.profileKey || rangedWeapon?.id
            : key === "mounted-aerial-rider-melee-attack"
              ? meleeWeapon?.profileKey || meleeWeapon?.id
              : "";
        actions.push(makeAction({
          actor,
          currentTurnEntry,
          id: key,
          name: flightContract.label,
          type: key,
          source: "canonical mounted-flight catalog",
          category: flightContract.category,
          costActions: flightContract.actionCost,
          targetRequired: Boolean(flightContract.targetRequirements),
          targetId: selectedTargetId(selectedTarget),
          enabled: mountedTurn?.state === "active" && ownerActions > 0,
          disabledReason: mountedTurn?.state !== "active" ? "No active mounted-flight turn." : ownerActions <= 0 ? "No mounted-flight actions remaining." : "",
          previewSummary: `${flightContract.label} through canonical ${flightContract.owner} ownership.`,
          metadata: {
            executor: flightContract.executor,
            actionOwner: flightContract.owner,
            staminaOwner: flightContract.staminaOwner || "none",
            turnEnding: flightContract.turnEnding,
            pairId: activeLink.mountedFlightState?.pairId || activeLink.linkId,
            mountedTurnId: mountedTurn?.mountedTurnId || "",
            attackId,
            attachmentState: activeLink.mountedFlightState?.attachmentState,
            flightState,
          },
        }));
      });
      return actions;
    }
    actions.push(makeAction({
      actor,
      currentTurnEntry,
      id: "dismount",
      name: "Dismount",
      type: "dismount",
      source: "canonical carrier catalog",
      category: "Carrier",
      costActions: 1,
      previewSummary: "Release the mounted link into a legal adjacent position.",
      metadata: {
        executor: "releaseCanonicalCarrierLink",
        relationshipType: "mounted",
        legalRelationshipState: activeLink.state,
      },
    }));
    actions.push(makeAction({
      actor,
      currentTurnEntry,
      id: "emergency-dismount",
      name: "Emergency Dismount",
      type: "emergency-dismount",
      source: "canonical carrier catalog",
      category: "Carrier",
      costActions: 1,
      previewSummary: "Release immediately through canonical fall and stability authority.",
      metadata: {
        executor: "releaseCanonicalCarrierLink",
        relationshipType: "mounted",
        legalRelationshipState: activeLink.state,
      },
    }));
    const mountedTurn = carrierContext.mountedTurn || null;
    const mount = carrierContext.mount || null;
    const controlState = activeLink.mountedState?.controlState || "controlled";
    const riderWeapons = actor.weaponProfiles || actor.attacks || [];
    const meleeWeapon = riderWeapons.find((weapon) => !["projectile", "ranged"].includes(normalizeText(weapon.deliveryType || weapon.kind).toLowerCase()));
    const rangedWeapon = riderWeapons.find((weapon) => ["projectile", "ranged"].includes(normalizeText(weapon.deliveryType || weapon.kind).toLowerCase()));
    const mountNaturalAttack = mount?.naturalAttackProfiles?.[0] || null;
    const mountedKeys = [
      "control-mount",
      "mounted-walk",
      "mounted-run",
      ...(meleeWeapon ? ["mounted-rider-strike"] : []),
      ...(rangedWeapon ? ["mounted-rider-ranged-attack"] : []),
      ...(mountNaturalAttack ? ["mount-natural-attack"] : []),
      ...(meleeWeapon && carrierContext.chargePath?.straightLine === true ? ["mounted-charge"] : []),
      ...(controlState === "out-of-control" ? ["recover-mounted-control"] : []),
    ];
    mountedKeys.forEach((key) => {
      const contract = MOUNTED_ACTION_CONTRACTS[key];
      const ownerActions = contract.owner === "mount"
        ? mountedTurn?.mountActionsRemaining
        : contract.owner === "rider"
          ? mountedTurn?.riderActionsRemaining
          : Math.min(mountedTurn?.riderActionsRemaining ?? 0, mountedTurn?.mountActionsRemaining ?? 0);
      actions.push(makeAction({
        actor,
        currentTurnEntry,
        id: key,
        name: contract.label,
        type: key,
        source: "canonical mounted catalog",
        category: contract.category,
        costActions: contract.actionCost,
        targetRequired: ["mounted-charge", "mounted-rider-strike", "mounted-rider-ranged-attack", "mount-natural-attack"].includes(key),
        targetId: selectedTargetId(selectedTarget),
        enabled: mountedTurn?.state === "active" && ownerActions > 0,
        disabledReason: mountedTurn?.state !== "active" ? "No active mounted turn." : ownerActions <= 0 ? "No mounted actions remaining." : "",
        previewSummary: `${contract.label} through canonical ${contract.owner} ownership.`,
        metadata: {
          executor: contract.executor,
          actionOwner: contract.owner,
          staminaOwner: contract.staminaOwner || "none",
          rollRequired: String(contract.rollRequired),
          turnEnding: contract.turnEnding,
          pairId: activeLink.mountedState?.pairId || activeLink.linkId,
          mountedTurnId: mountedTurn?.mountedTurnId || "",
          attackId: key === "mount-natural-attack"
            ? mountNaturalAttack?.profileKey || mountNaturalAttack?.attackKey
            : key === "mounted-rider-ranged-attack"
              ? rangedWeapon?.profileKey || rangedWeapon?.id
              : meleeWeapon?.profileKey || meleeWeapon?.id,
        },
      }));
    });
  }
  return actions;
};

const buildItemActions = ({ actor, currentTurnEntry, inventory }) =>
  getInventoryCandidates({ actor, inventory })
    .filter((item) => item && typeof item !== "function")
    .map((item, index) => {
      const itemName = normalizeText(typeof item === "string" ? item : item.name || item.label || item.type, "Item");
      const itemId = normalizeText(typeof item === "object" ? item.id || item._id || item.itemId : "", "");
      const itemCategory = normalizeText(typeof item === "object" ? item.category || item.type || item.subtype : "", "");
      const itemSource = normalizeText(typeof item === "object" ? item.source || item.container : "", "inventory");
      return makeAction({
        actor,
        currentTurnEntry,
        id: `use-item-${itemId || itemName}-${index}`,
        name: `Use Item: ${itemName}`,
        type: "use-item",
        source: itemSource,
        category: itemCategory || "Item",
        costActions: 1,
        previewSummary: "Item effect handler pending.",
        metadata: {
          actorId: getEntryId(actor),
          actorName: actor?.name,
          itemName,
          itemId,
          itemSource,
          itemCategory,
          itemType: itemCategory,
        },
      });
    });

const buildHuntingActions = ({
  actor,
  currentTurnEntry,
  selectedTarget,
  huntingContext = {},
}) => {
  const encounter = huntingContext.encounter;
  if (!encounter || encounter.state !== "active") return [];
  const actorId = getEntryId(actor);
  if (!encounter.hunterIds?.includes?.(actorId)) return [];
  const targetId = selectedTargetId(selectedTarget);
  return Object.values(HUNTING_ACTION_CONTRACTS)
    .filter((contract) => contract.playerVisible && contract.legalPhases.includes(encounter.phase))
    .map((contract) => makeAction({
      actor,
      currentTurnEntry,
      id: contract.key,
      name: contract.label,
      type: contract.key,
      source: contract.deferred ? "canonical harvest boundary" : "canonical hunting catalog",
      category: "Hunting",
      costActions: contract.actionCost,
      targetRequired: contract.targetRequired,
      targetId,
      enabled: !contract.deferred && (!contract.targetRequired || Boolean(targetId)),
      disabledReason: contract.deferred
        ? "Harvest transfer is deferred; eligibility only."
        : contract.targetRequired && !targetId
          ? "Select a quarry or hunting target."
          : "",
      previewSummary: contract.deferred
        ? "Create the field-dressing and harvest eligibility boundary without transferring inventory."
        : `${contract.label} through canonical hunting ownership.`,
      metadata: {
        executor: contract.executor,
        encounterPhase: encounter.phase,
        encounterId: encounter.encounterId,
        staminaOwner: contract.staminaOwner || "none",
        rollBehavior: contract.rollBehavior,
        deferred: contract.deferred,
      },
    }));
};

const buildCarcassProcessingActions = ({
  actor,
  currentTurnEntry,
  processingContext = {},
}) => {
  const carcass = processingContext.carcass;
  if (!carcass || carcass.processingFinalized || carcass.state === "abandoned") return [];
  const availableResources = new Set(processingContext.availableResourceKeys || []);
  return Object.values(CARCASS_PROCESSING_ACTIONS)
    .filter((contract) => contract.playerVisible)
    .filter((contract) => !contract.resourceKey || availableResources.has(contract.resourceKey))
    .filter((contract) => contract.legalRecoveryStates.includes(carcass.recoveryState))
    .filter((contract) => contract.legalProcessingStates.includes(carcass.processingState))
    .map((contract) => makeAction({
      actor,
      currentTurnEntry,
      id: contract.key,
      name: contract.label,
      type: contract.key,
      source: "canonical carcass processing",
      category: "Post-hunt",
      costActions: contract.actionCost,
      targetRequired: true,
      targetId: carcass.carcassId,
      enabled: true,
      previewSummary: `${contract.label} through canonical post-hunt processing ownership.`,
      metadata: {
        executor: contract.executor,
        owner: contract.owner,
        toolCapability: contract.toolCapability || "none",
        inventoryTransferBehavior: contract.inventoryTransferBehavior,
        resourceKey: contract.resourceKey || "",
        carcassId: carcass.carcassId,
      },
    }));
};

const buildSkillActions = ({ actor, currentTurnEntry }) =>
  getSkillCandidates({ actor })
    .map((skill, index) => {
      const skillName = normalizeText(skill.name, "Skill");
      const skillId = normalizeText(skill.id, "");
      const skillSource = normalizeText(skill.source, "skill");
      const skillCategory = normalizeText(skill.category, "");
      return makeAction({
        actor,
        currentTurnEntry,
        id: `use-skill-${skillId || skillName}-${index}`,
        name: `Use Skill: ${skillName}`,
        type: "use-skill",
        source: skillSource,
        category: skillCategory || "Skill",
        costActions: 1,
        previewSummary: "Skill handler pending.",
        metadata: {
          actorId: getEntryId(actor),
          actorName: actor?.name,
          skillName,
          actionName: skillName,
          skillId,
          skillSource,
          skillCategory,
          skillType: skillCategory,
        },
      });
    });

const buildConcealmentAndAimActions = ({ actor, currentTurnEntry, selectedTarget }) => {
  const targetId = selectedTargetId(selectedTarget);
  const rangedWeapon = getWeaponCandidates({ actor }).find((weapon) => (
    weapon?.isRanged === true || ["ranged", "projectile"].includes(normalizeText(weapon?.type).toLowerCase())
  ));
  return Object.values(CONCEALMENT_ACTIONS).map((contract) => makeAction({
    actor,
    currentTurnEntry,
    id: contract.key,
    name: contract.label,
    type: contract.key,
    source: "canonical concealment and ranged catalog",
    category: contract.key === "aim" ? "Ranged" : "Stealth",
    costActions: contract.actionCost,
    targetRequired: contract.key === "aim",
    targetId,
    enabled: contract.key !== "aim" || Boolean(targetId && rangedWeapon),
    disabledReason: contract.key === "aim" && !targetId
      ? "Select a visible target."
      : contract.key === "aim" && !rangedWeapon
        ? "A compatible ranged weapon is required."
        : "",
    previewSummary: contract.key === "hide"
      ? "Use real terrain concealment; training improves but is not required."
      : contract.key === "sneak"
        ? "Move once through connected concealment with observer-specific detection."
        : "Spend one action for a nonstacking +2 on the next legal shot at this target with this weapon.",
    metadata: {
      executor: contract.executor,
      weaponId: rangedWeapon?.weaponId || rangedWeapon?.profileKey || "",
      nonstacking: contract.key === "aim",
    },
  }));
};

const compatibilityTypeFor = (label) => {
  const normalized = label.toLowerCase();
  if (normalized.includes("skill") || normalized.includes("hide") || normalized.includes("prowl")) return "use-skill";
  if (normalized.includes("move")) return "move";
  if (normalized.includes("run")) return "run";
  if (normalized.includes("charge")) return "charge";
  if (normalized.includes("block")) return "block";
  if (normalized.includes("evade")) return "evade";
  if (normalized.includes("defend")) return "defend";
  return "compatibility";
};

const buildCompatibilityActions = ({ actor, currentTurnEntry, compatibilityActions }) => {
  const entries = toArray(compatibilityActions).length > 0
    ? compatibilityActions
    : [
        { value: "Use Skill", label: "Use Skill" },
        { value: "Combat Maneuvers", label: "Maneuver" },
        { value: "Hide", label: "Hide / Prowl" },
      ];

  return entries.map((entry, index) => {
    const label = normalizeText(entry?.label || entry?.name || entry?.value || entry, "Compatibility Action");
    const type = compatibilityTypeFor(label);
    const skillName = type === "use-skill"
      ? normalizeText(entry?.skillName || entry?.name || entry?.label || entry?.value || entry, "Use Skill")
      : "";
    return makeAction({
      actor,
      currentTurnEntry,
      id: `compatibility-${entry?.value || label}-${index}`,
      name: label,
      type,
      source: "compatibility controls",
      category: type === "use-skill" ? "Skill" : "Compatibility",
      costActions: 1,
      previewSummary: type === "use-skill"
        ? "Skill handler pending."
        : "Compatibility control remains available outside this catalog.",
      metadata: {
        actorId: getEntryId(actor),
        actorName: actor?.name,
        compatibilityValue: normalizeText(entry?.value || label, label),
        skillName,
        actionName: skillName,
        skillId: normalizeText(entry?.id || entry?._id || entry?.skillId, ""),
        skillSource: type === "use-skill" ? "compatibility controls" : "",
        skillCategory: type === "use-skill" ? "Skill" : "",
      },
    });
  });
};

export function buildCombatActionCatalog({
  actor,
  targets,
  currentTurnEntry,
  selectedTarget,
  equippedWeapons,
  inventory,
  compatibilityActions,
  carrierContext,
  huntingContext,
  processingContext,
} = {}) {
  if (!actor || typeof actor !== "object") return [];

  const targetId = selectedTargetId(selectedTarget);
  const actions = [];
  const attackPreviews = getActorAttackPreviews(actor);
  attackPreviews.forEach((entry, index) => {
    addUnique(actions, buildAttackAction({
      actor,
      currentTurnEntry,
      entry,
      index,
      targetId,
      selectedTarget,
      source: "attack preview",
    }));
  });

  getWeaponCandidates({ actor, equippedWeapons }).forEach((weapon, index) => {
    if (isUnarmedWeapon(weapon)) return;
    addUnique(actions, buildAttackAction({
      actor,
      currentTurnEntry,
      entry: weapon,
      index,
      targetId,
      selectedTarget,
      source: "equipped weapon",
    }));
  });

  if (!actions.some((action) => action.type === "attack")) {
    addUnique(actions, buildUnarmedAction({ actor, currentTurnEntry, targetId, selectedTarget }));
  }

  const activeCarrierLink = carrierContext?.activeLink || actor?.carrierLink || null;
  const actorMounted = ["mounted", "flying-mounted"].includes(activeCarrierLink?.relationshipType)
    && String(activeCarrierLink.passengerId) === getEntryId(actor)
    && !["released", "broken"].includes(activeCarrierLink.state);
  if (!actorMounted) buildMovementActions({ actor, currentTurnEntry, targetId }).forEach((action) => addUnique(actions, action));
  buildDefensiveRecoveryActions({ actor, currentTurnEntry }).forEach((action) => addUnique(actions, action));
  buildCarrierActions({ actor, currentTurnEntry, selectedTarget, carrierContext }).forEach((action) => addUnique(actions, action));
  buildHuntingActions({ actor, currentTurnEntry, selectedTarget, huntingContext }).forEach((action) => addUnique(actions, action));
  buildConcealmentAndAimActions({ actor, currentTurnEntry, selectedTarget }).forEach((action) => addUnique(actions, action));
  buildCarcassProcessingActions({ actor, currentTurnEntry, processingContext }).forEach((action) => addUnique(actions, action));
  buildItemActions({ actor, currentTurnEntry, inventory }).forEach((action) => addUnique(actions, action));
  buildSkillActions({ actor, currentTurnEntry }).forEach((action) => addUnique(actions, action));
  buildCompatibilityActions({ actor, currentTurnEntry, compatibilityActions }).forEach((action) => addUnique(actions, action));

  const routedActions = actorMounted
    ? actions.filter((action) => !["attack", "projectile", "extended-melee"].includes(action.type))
    : actions;
  return routedActions.map((action, index) => ({
    ...action,
    id: action.id || `action-${index}`,
    metadata: sanitizeMetadata({
      ...action.metadata,
      actorId: getEntryId(actor),
      actorName: actor.name,
      targetCount: toArray(targets).length,
    }),
  }));
}

export default {
  buildCombatActionCatalog,
};
