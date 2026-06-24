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

  return {
    id: normalizeId(id, normalizeId(name, "action")),
    name: normalizeText(name, "Unnamed action"),
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

const buildAttackAction = ({ actor, currentTurnEntry, entry, index, targetId, source }) => {
  const name = normalizeText(entry.name || entry.label || entry.attackName, "Unnamed attack");
  const slot = normalizeText(entry.slot || entry.hand || entry.position, "");
  const actionName = source === "equipped weapon" && slot
    ? `Attack with ${name} (${slot})`
    : `Attack with ${name}`;
  const reachFt = parseFeet(entry.reachFt ?? entry.reach);
  const rangeFt = parseFeet(entry.rangeFt ?? entry.range);
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
    previewSummary: buildAttackSummary(entry) || "Attack preview pending.",
    metadata: {
      attackName: name,
      attackType: entry.attackType || entry.type,
      damageType: entry.damageType,
      slot,
    },
  });
};

const buildUnarmedAction = ({ actor, currentTurnEntry, targetId }) =>
  makeAction({
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
    previewSummary: "Basic close attack, reach 5 ft.",
    metadata: {
      attackName: "Unarmed Strike",
      attackType: "close",
    },
  });

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
    name: "Move",
    type: "move",
    source: "movement",
    category: "Movement",
    costActions: 1,
    costStamina: 0,
    previewSummary: "Standard movement command.",
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
    source: "compatibility control",
    category: "Defense",
    costActions: 1,
    previewSummary: "Existing compatibility control remains available.",
  }),
  makeAction({
    actor,
    currentTurnEntry,
    id: "evade",
    name: "Evade",
    type: "evade",
    source: "compatibility control",
    category: "Defense",
    costActions: 1,
    previewSummary: "Existing compatibility control remains available.",
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
    previewSummary: "Restore 2 stamina.",
    metadata: {
      recoveryAmount: 2,
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
    return makeAction({
      actor,
      currentTurnEntry,
      id: `compatibility-${entry?.value || label}-${index}`,
      name: label,
      type,
      source: "compatibility controls",
      category: type === "use-skill" ? "Skill" : "Compatibility",
      costActions: 1,
      previewSummary: "Compatibility control remains available outside this catalog.",
      metadata: {
        compatibilityValue: normalizeText(entry?.value || label, label),
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
      source: "equipped weapon",
    }));
  });

  if (!actions.some((action) => action.type === "attack")) {
    addUnique(actions, buildUnarmedAction({ actor, currentTurnEntry, targetId }));
  }

  buildMovementActions({ actor, currentTurnEntry, targetId }).forEach((action) => addUnique(actions, action));
  buildDefensiveRecoveryActions({ actor, currentTurnEntry }).forEach((action) => addUnique(actions, action));
  buildItemActions({ actor, currentTurnEntry, inventory }).forEach((action) => addUnique(actions, action));
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
