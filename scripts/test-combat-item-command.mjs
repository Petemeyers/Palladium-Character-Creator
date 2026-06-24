import assert from "node:assert/strict";

import { buildCombatActionCatalog } from "../src/utils/combatActionCatalog.js";
import {
  buildUseItemCommandResult,
  canUseItemCommand,
  getItemCommandPreview,
} from "../src/utils/combatItemCommand.js";

const hasFunction = (value) => {
  if (typeof value === "function") return true;
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(hasFunction);
};

const hasRawObjectInPreview = (value) =>
  Object.entries(value || {}).some(([, entry]) => entry && typeof entry === "object");

const actor = {
  id: "fighter-1",
  name: "Shield Bearer",
  remainingActions: 1,
  currentStamina: 3,
  inventory: [
    {
      id: "bandage-1",
      name: "Linen Bandage",
      type: "supply",
      category: "field supply",
      use: () => "ignored",
    },
  ],
};
const item = actor.inventory[0];
const actorSnapshot = JSON.stringify({
  id: actor.id,
  name: actor.name,
  remainingActions: actor.remainingActions,
  currentStamina: actor.currentStamina,
  inventory: [{ id: item.id, name: item.name, type: item.type, category: item.category }],
});
const itemSnapshot = JSON.stringify({ id: item.id, name: item.name, type: item.type, category: item.category });

const catalog = buildCombatActionCatalog({
  actor,
  currentTurnEntry: actor,
  inventory: actor.inventory,
});
const useItemAction = catalog.find((action) => action.type === "use-item");

assert.ok(useItemAction, "actor inventory item creates a use-item action");
assert.equal(useItemAction.name, "Use Item: Linen Bandage");
assert.equal(useItemAction.metadata.actorId, "fighter-1");
assert.equal(useItemAction.metadata.actorName, "Shield Bearer");
assert.equal(useItemAction.metadata.itemName, "Linen Bandage");
assert.equal(useItemAction.metadata.itemId, "bandage-1");
assert.equal(useItemAction.metadata.itemSource, "inventory");
assert.equal(useItemAction.metadata.itemCategory, "field supply");
assert.equal(hasFunction(useItemAction), false, "use-item action contains no functions");

const preview = getItemCommandPreview({ actor, item, action: useItemAction });
assert.equal(preview.itemName, "Linen Bandage");
assert.equal(preview.itemSource, "inventory");
assert.equal(preview.itemCategory, "field supply");
assert.equal(preview.handlerStatus, "Item effect handler pending.");
assert.equal(hasFunction(preview), false, "item preview contains no functions");
assert.equal(hasRawObjectInPreview(preview), false, "item preview contains no raw objects");

const pending = canUseItemCommand({
  actor,
  item,
  action: useItemAction,
  currentTurnEntry: actor,
});
assert.equal(pending.ok, false);
assert.equal(pending.reason, "Item effect handler pending.");

const missingItem = canUseItemCommand({
  actor,
  item: null,
  action: { ...useItemAction, metadata: {} },
  currentTurnEntry: actor,
});
assert.equal(missingItem.ok, false);
assert.equal(missingItem.reason, "Item data unavailable.");

const wrongActor = canUseItemCommand({
  actor,
  item,
  action: useItemAction,
  currentTurnEntry: { ...actor, id: "other-fighter" },
});
assert.equal(wrongActor.ok, false);
assert.equal(wrongActor.reason, "Use Item can only be used by the current turn combatant.");

const noActions = canUseItemCommand({
  actor,
  item,
  action: useItemAction,
  currentTurnEntry: { ...actor, remainingActions: 0 },
});
assert.equal(noActions.ok, false);
assert.equal(noActions.reason, "No actions remaining. End Turn manually.");

const result = buildUseItemCommandResult({
  actor,
  item,
  action: useItemAction,
  currentTurnEntry: actor,
});
assert.equal(result.ok, false);
assert.equal(result.message, "Item effect handler pending.");
assert.equal(hasFunction(result), false, "item command result contains no functions");

assert.doesNotThrow(() => getItemCommandPreview({ actor: null, item: null, action: null }));
assert.doesNotThrow(() => canUseItemCommand({ actor: null, item: null, currentTurnEntry: null }));
assert.equal(JSON.stringify({
  id: actor.id,
  name: actor.name,
  remainingActions: actor.remainingActions,
  currentStamina: actor.currentStamina,
  inventory: [{ id: item.id, name: item.name, type: item.type, category: item.category }],
}), actorSnapshot, "item helper does not mutate actor");
assert.equal(JSON.stringify({ id: item.id, name: item.name, type: item.type, category: item.category }), itemSnapshot, "item helper does not mutate item");

console.log("combat item command tests passed");
