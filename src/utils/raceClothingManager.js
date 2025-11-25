/**
 * Race Clothing Manager
 * Handles race-specific clothing trade-ins based on character race
 */

import clothingEquipment from "../data/clothingEquipment.json";

/**
 * Get race-specific clothing options for a character
 * @param {string} race - Character race
 * @returns {Array} Array of clothing options available for the race
 */
export function getRaceClothingOptions(race) {
  const raceKey = race.charAt(0).toUpperCase() + race.slice(1).toLowerCase();
  const raceData = clothingEquipment.raceClothing[raceKey];

  if (!raceData) {
    console.warn(`No race data found for: ${race}`);
    return [];
  }

  // Map race clothing names to available items in the database
  const clothingOptions = [];

  // Map race clothing to actual database items
  const clothingMappings = {
    // Human clothing - map to available items
    "Cloth hood": "Cloth Hood",
    "Wool tunic": "Wool Tunic",
    "Leather breeches": "Leather Breeches",
    "Sturdy boots": "Leather Boots", // Map to available item
    "Linen gloves": "Linen Gloves",

    // Wolfen clothing - map to available items
    "Fur hood": "Leather Cap", // Map to available item
    "Hide tunic": "Leather Jerkin", // Map to available item
    "Wolfskin breeches": "Leather Breeches", // Renamed to avoid duplicate
    "Hide boots": "Leather Boots", // Map to available item
    "Fur wraps": "Fur Wraps",

    // Elf clothing - map to available items
    "Silk hood": "Cloth Hood", // Map to available item
    "Silk tunic": "Silk Robe", // Map to available item
    "Fine breeches": "Silk Breeches", // Map to available item
    "Soft boots": "Cloth Shoes", // Map to available item
    "Silk gloves": "Linen Gloves", // Map to available item

    // Dwarf clothing - map to available items
    "Wool cap": "Leather Cap", // Map to available item
    "Heavy tunic": "Wool Tunic", // Map to available item
    "Wool breeches": "Cloth Breeches", // Map to available item
    "Heavy boots": "Leather Boots", // Map to available item
    "Leather gloves": "Leather Gloves",

    // Gnome clothing - map to available items
    "Colorful cap": "Bandana", // Map to available item
    "Fine tunic": "Linen Tunic", // Map to available item
    "Light breeches": "Cloth Breeches", // Map to available item
    "Soft shoes": "Cloth Shoes", // Map to available item
    "Fine gloves": "Linen Gloves", // Map to available item

    // Orc clothing - map to available items
    "Rough hood": "Cloth Hood", // Map to available item
    "Coarse tunic": "Leather Jerkin", // Map to available item
    "Orc leather wraps": "Fur Wraps", // Renamed to avoid confusion

    // Ogre clothing - map to available items
    "Ogre hide cap": "Leather Cap", // Map to available item

    // Troll clothing - map to available items
    "Troll hide cap": "Leather Cap", // Map to available item

    // Troglodyte clothing - map to available items
    "Fungus hood": "Cloth Hood", // Map to available item
    "Cave silk tunic": "Silk Robe", // Map to available item
    "Fungus breeches": "Cloth Breeches", // Map to available item
    "Cloth wraps": "Linen Gloves", // Map to available item

    // Kobold clothing - map to available items
    "Metal cap": "Metal Circlet", // Map to available item
    "Metal bracers": "Leather Gloves", // Map to available item

    // Goblin clothing - map to available items
    "Patchwork cap": "Bandana", // Map to available item
    "Patchwork tunic": "Cloth Hood", // Map to available item

    // Hob-Goblin clothing - map to available items
    "Military cap": "Leather Cap", // Map to available item
    "Military tunic": "Leather Jerkin", // Map to available item

    // Changeling clothing - map to available items
    "Adaptive hood": "Cloth Hood", // Map to available item
    "Adaptive tunic": "Silk Robe", // Map to available item
    "Adaptive breeches": "Silk Breeches", // Map to available item
    "Adaptive boots": "Leather Boots", // Map to available item
    "Adaptive gloves": "Leather Gloves", // Map to available item
  };

  // Convert race data to clothing options
  Object.entries(raceData).forEach(([slot, clothingName]) => {
    if (slot !== "materials" && slot !== "colors" && slot !== "style") {
      const mappedName = clothingMappings[clothingName];
      if (mappedName) {
        clothingOptions.push({
          name: mappedName,
          slot: slot,
          originalName: clothingName,
          race: raceKey,
        });
      }
    }
  });

  return clothingOptions;
}

/**
 * Check if a character has basic clothes that can be traded in
 * @param {Object} character - Character object
 * @returns {boolean} True if character has basic clothes
 */
export function hasBasicClothes(character) {
  console.log("🔄 DEBUG: Checking if character has basic clothes");
  console.log("🔄 DEBUG: Character:", character);
  console.log("🔄 DEBUG: Character inventory:", character?.inventory);

  if (!character.inventory || !Array.isArray(character.inventory)) {
    console.log("❌ DEBUG: No inventory or inventory is not an array");
    return false;
  }

  const hasBasic = character.inventory.some((item) => {
    console.log("🔄 DEBUG: Checking item:", item);
    const itemName = item.name?.toLowerCase() || "";
    const isBasic =
      itemName.includes("basic clothes") ||
      itemName.includes("basic set of clothes") ||
      itemName.includes("set of clothes");
    console.log("🔄 DEBUG: Item name:", item.name, "Is basic:", isBasic);
    return item.name && isBasic;
  });

  console.log("🔄 DEBUG: Character has basic clothes:", hasBasic);
  return hasBasic;
}

/**
 * Get available race clothing for trade-in
 * @param {string} race - Character race
 * @returns {Array} Array of clothing items with full details
 */
export function getAvailableRaceClothing(race) {
  console.log("🔄 DEBUG: Getting available race clothing for race:", race);

  const options = getRaceClothingOptions(race);
  console.log("🔄 DEBUG: Race clothing options:", options);

  const clothingItems = clothingEquipment.clothingItems;
  console.log("🔄 DEBUG: Available clothing items:", clothingItems);

  const result = options.map((option) => {
    console.log("🔄 DEBUG: Processing option:", option);

    // Find the item in clothingItems by slot and name
    const slotItems = clothingItems[option.slot] || [];
    console.log("🔄 DEBUG: Slot items for", option.slot, ":", slotItems);

    const itemDetails = slotItems.find((item) => item.name === option.name);
    console.log("🔄 DEBUG: Found item details:", itemDetails);

    const finalItem = {
      ...option,
      ...itemDetails,
      type: "clothing",
      category: "Clothing",
      description:
        itemDetails?.description ||
        `Traditional ${race.toLowerCase()} ${option.slot} clothing`,
    };

    console.log("🔄 DEBUG: Final item:", finalItem);
    return finalItem;
  });

  console.log("🔄 DEBUG: Final result:", result);
  return result;
}

/**
 * Get race clothing description and style info
 * @param {string} race - Character race
 * @returns {Object} Race clothing information
 */
export function getRaceClothingInfo(race) {
  const raceKey = race.charAt(0).toUpperCase() + race.slice(1).toLowerCase();
  const raceData = clothingEquipment.raceClothing[raceKey];

  if (!raceData) {
    return {
      materials: [],
      colors: [],
      style: "Unknown style",
    };
  }

  return {
    materials: raceData.materials || [],
    colors: raceData.colors || [],
    style: raceData.style || "Unknown style",
  };
}
