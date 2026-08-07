const normalizeText = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
const toFinite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clone = (value) => JSON.parse(JSON.stringify(value));

export const SHIELD_AFTERMATH_ACTIONS = Object.freeze({
  FIELD_REPAIR: "field-repair-shield",
  WORKSHOP_REPAIR: "workshop-repair-shield",
  SALVAGE: "salvage-shield",
});

export const buildShieldAftermathItem = ({ shield = null, shieldIntegrity = null, sourceActorId = null } = {}) => {
  if (!shield && !shieldIntegrity) return null;
  const name = String(shield?.name || shield?.displayName || shieldIntegrity?.name || "Shield");
  const maxDurability = Math.max(1, toFinite(shieldIntegrity?.maxDurability ?? shield?.maxDurability ?? shield?.durability, 14));
  const currentDurability = Math.max(0, Math.min(maxDurability, toFinite(shieldIntegrity?.currentDurability ?? shield?.currentDurability ?? shield?.durability, maxDurability)));
  const state = normalizeText(shieldIntegrity?.state || shield?.integrityState || (currentDurability <= 0 ? "broken" : currentDurability <= maxDurability * 0.35 ? "battered" : currentDurability < maxDurability ? "worn" : "pristine"));
  return {
    itemId: String(shield?.id || shield?.profileKey || shieldIntegrity?.shieldId || `${sourceActorId || "actor"}:shield`),
    name,
    category: "shield",
    sourceActorId,
    currentDurability,
    maxDurability,
    integrityState: state,
    broken: currentDurability <= 0 || state === "broken",
    repairHistory: [],
    repairable: true,
    salvageable: true,
    confiscated: false,
  };
};

export const getShieldAftermathOptions = (item = {}) => {
  if (normalizeText(item.category) !== "shield") return [];
  const current = toFinite(item.currentDurability, 0);
  const max = Math.max(1, toFinite(item.maxDurability, 1));
  const options = [];
  if (current < max && current > 0) {
    options.push({ id: SHIELD_AFTERMATH_ACTIONS.FIELD_REPAIR, label: "Field Repair", materialCost: 1, timeDays: 1 });
    options.push({ id: SHIELD_AFTERMATH_ACTIONS.WORKSHOP_REPAIR, label: "Workshop Repair", materialCost: 2, timeDays: 2 });
  } else if (current <= 0) {
    options.push({ id: SHIELD_AFTERMATH_ACTIONS.WORKSHOP_REPAIR, label: "Rebuild Shield", materialCost: 3, timeDays: 3 });
  }
  if (item.salvageable !== false) options.push({ id: SHIELD_AFTERMATH_ACTIONS.SALVAGE, label: "Salvage Fittings", materialCost: 0, timeDays: 0 });
  return options;
};

export const resolveShieldAftermathAction = ({ encounter, itemId, action, currentDay = null } = {}) => {
  if (!encounter || !itemId || !action) return { accepted: false, reason: "missing-action-data" };
  const nextEncounter = clone(encounter);
  const index = (nextEncounter.lootLedger || []).findIndex((item) => String(item.itemId) === String(itemId));
  if (index < 0) return { accepted: false, reason: "loot-item-not-found" };
  const item = nextEncounter.lootLedger[index];
  if (normalizeText(item.category) !== "shield") return { accepted: false, reason: "item-not-shield" };
  const supplies = nextEncounter.supplies || (nextEncounter.supplies = {});
  supplies.repairMaterials = Math.max(0, toFinite(supplies.repairMaterials, 0));
  const day = Number.isFinite(Number(currentDay)) ? Number(currentDay) : toFinite(nextEncounter.currentDay, 0);

  if (action === SHIELD_AFTERMATH_ACTIONS.SALVAGE) {
    nextEncounter.lootLedger.splice(index, 1);
    supplies.repairMaterials += item.broken ? 2 : 1;
    nextEncounter.eventLog = [...(nextEncounter.eventLog || []), {
      eventId: `${nextEncounter.encounterId}:shield-salvage:${itemId}:${day}`,
      day,
      type: "shield-salvaged",
      message: `${item.name} was dismantled for fittings and repair material.`,
      createdAt: new Date().toISOString(),
    }];
    return { accepted: true, encounter: nextEncounter, item, action, materialsRecovered: item.broken ? 2 : 1, message: `${item.name} was salvaged.` };
  }

  const workshop = action === SHIELD_AFTERMATH_ACTIONS.WORKSHOP_REPAIR;
  const materialCost = workshop ? (item.broken ? 3 : 2) : 1;
  if (supplies.repairMaterials < materialCost) return { accepted: false, reason: "insufficient-repair-materials" };
  supplies.repairMaterials -= materialCost;
  const current = Math.max(0, toFinite(item.currentDurability, 0));
  const originalMax = Math.max(1, toFinite(item.maxDurability, 14));
  const repairedMax = workshop ? originalMax : Math.max(1, Math.floor(originalMax * 0.9));
  const restored = workshop ? repairedMax : Math.min(repairedMax, current + Math.max(3, Math.ceil(originalMax * 0.35)));
  const repaired = {
    ...item,
    currentDurability: restored,
    maxDurability: repairedMax,
    broken: false,
    integrityState: restored >= repairedMax * 0.75 ? "worn" : "battered",
    repairHistory: [...(item.repairHistory || []), {
      day,
      action,
      materialCost,
      previousDurability: current,
      nextDurability: restored,
      previousMaxDurability: originalMax,
      nextMaxDurability: repairedMax,
    }],
  };
  nextEncounter.lootLedger[index] = repaired;
  nextEncounter.eventLog = [...(nextEncounter.eventLog || []), {
    eventId: `${nextEncounter.encounterId}:shield-repair:${itemId}:${day}`,
    day,
    type: workshop ? "shield-workshop-repaired" : "shield-field-repaired",
    message: `${item.name} was ${workshop ? "repaired in the workshop" : "patched in the field"}.`,
    createdAt: new Date().toISOString(),
  }];
  return { accepted: true, encounter: nextEncounter, item: repaired, action, materialCost, message: `${item.name} was repaired.` };
};
