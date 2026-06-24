const hasValue = (value) => value !== undefined && value !== null && value !== "";

const toNumber = (value) => {
  if (!hasValue(value) || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const cleanText = (value, fallback = "") => {
  if (typeof value === "string") {
    const trimmed = value.replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
    return trimmed || fallback;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
};

const getId = (value) =>
  cleanText(value?.id || value?._id || value?.fighterId || value?.characterId || value?.name, "");

const itemNameFrom = (item, action) =>
  cleanText(
    item?.name ||
      item?.label ||
      item?.type ||
      action?.metadata?.itemName ||
      action?.itemName,
    ""
  );

const itemIdFrom = (item, action) =>
  cleanText(
    item?.id ||
      item?._id ||
      item?.itemId ||
      action?.metadata?.itemId ||
      action?.itemId,
    ""
  );

const itemSourceFrom = (item, action) =>
  cleanText(
    action?.metadata?.itemSource ||
      action?.source ||
      item?.source ||
      item?.container ||
      "inventory",
    "inventory"
  );

const itemCategoryFrom = (item, action) =>
  cleanText(
    item?.category ||
      item?.type ||
      item?.subtype ||
      action?.metadata?.itemCategory ||
      action?.metadata?.itemType,
    ""
  );

export function getItemCommandPreview({ actor, item, action } = {}) {
  const itemName = itemNameFrom(item, action);
  const itemSource = itemSourceFrom(item, action);
  const itemCategory = itemCategoryFrom(item, action);

  return {
    actionName: cleanText(action?.name, itemName ? `Use Item: ${itemName}` : "Use Item"),
    actorName: cleanText(actor?.name, "Current combatant"),
    itemName: itemName || "Unavailable item",
    itemId: itemIdFrom(item, action),
    itemSource,
    itemCategory,
    actionCost: toNumber(action?.costActions) ?? 1,
    staminaCost: toNumber(action?.costStamina) ?? 0,
    handlerStatus: "Item effect handler pending.",
    previewSummary: cleanText(action?.previewSummary, "Item effect handler pending."),
  };
}

export function canUseItemCommand({ actor, item, action, currentTurnEntry } = {}) {
  const actorId = getId(actor);
  const turnId = getId(currentTurnEntry);
  const actionActorId = cleanText(action?.metadata?.actorId, actorId);
  const remainingActions = toNumber(currentTurnEntry?.remainingActions ?? actor?.remainingActions);
  const actionCost = toNumber(action?.costActions) ?? 1;
  const itemName = itemNameFrom(item, action);
  const itemId = itemIdFrom(item, action);

  if (!actorId || !turnId || actorId !== turnId || (actionActorId && actionActorId !== turnId)) {
    return { ok: false, reason: "Use Item can only be used by the current turn combatant." };
  }
  if (actionCost > 0 && (remainingActions === null || remainingActions <= 0)) {
    return { ok: false, reason: "No actions remaining. End Turn manually." };
  }
  if (!itemName && !itemId) {
    return { ok: false, reason: "Item data unavailable." };
  }

  return { ok: false, reason: "Item effect handler pending." };
}

export function buildUseItemCommandResult({ actor, item, action, currentTurnEntry } = {}) {
  const preview = getItemCommandPreview({ actor, item, action });
  const guard = canUseItemCommand({ actor, item, action, currentTurnEntry });

  return {
    ok: guard.ok,
    preview,
    message: guard.reason || preview.handlerStatus,
  };
}

export default {
  buildUseItemCommandResult,
  canUseItemCommand,
  getItemCommandPreview,
};
