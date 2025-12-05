// src/utils/consumptionSystem.js
import { recoverStamina } from "./combatFatigueSystem";

/**
 * Remove a single item from a character's inventory by id.
 */
function removeItemById(character, itemId) {
  if (!character || !character.inventory) return;
  character.inventory = character.inventory.filter((i) => i.id !== itemId);
}

/**
 * Generic "consume" function: food, rations, potions, etc.
 * For now, rations just restore a bit of stamina.
 */
export function consumeItem(character, item, { log = () => {} } = {}) {
  if (!character || !item) return;

  const type = item.type || item.category || "item";

  if (type === "ration" || type === "food") {
    // Small stamina bump; HP recovery still handled by healingSystem
    recoverStamina(character, "FULL_REST", 1);
    log(`${character.name} eats ${item.name || "rations"} and feels a bit refreshed.`);
    removeItemById(character, item.id);
    return;
  }

  if (type === "consumable") {
    // You can later branch off item.effect here (heal, buff, etc.)
    log(`${character.name} uses ${item.name}. (Effect handling TODO)`);
    removeItemById(character, item.id);
    return;
  }

  log(`${character.name} tries to use ${item.name}, but nothing happens.`);
}

export default {
  consumeItem,
};

