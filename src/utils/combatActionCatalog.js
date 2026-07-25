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
  compatibility: { rollRequired: false, executorIdentity: "compatibility-controls-panel", aiAvailable: false },
});

export const getCombatActionContract = (type, source = "") => {
  const normalizedType = normalizeText(type, "compatibility");
  const contract = ACTION_CONTRACTS[normalizedType] || ACTION_CONTRACTS.compatibility;
  const compatibility = normalizeText(source).toLowerCase().includes("compatibility");
  return {
    ...contract,
    playerVisible: !compatibility,
    turnEnding: false,
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

  buildMovementActions({ actor, currentTurnEntry, targetId }).forEach((action) => addUnique(actions, action));
  buildDefensiveRecoveryActions({ actor, currentTurnEntry }).forEach((action) => addUnique(actions, action));
  buildItemActions({ actor, currentTurnEntry, inventory }).forEach((action) => addUnique(actions, action));
  buildSkillActions({ actor, currentTurnEntry }).forEach((action) => addUnique(actions, action));
  buildCompatibilityActions({ actor, currentTurnEntry, compatibilityActions }).forEach((action) => addUnique(actions, action));

  return actions.map((action, index) => ({
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
