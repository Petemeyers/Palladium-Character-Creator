import ShopItem from "../models/ShopItem.js";
import Character from "../models/Character.js";
import items from "../items.js";
// weaponShop import removed - using frontend data instead
import Weapon from "../models/Weapon.js";

// Fetch all shop items
export const getShopItems = async (req, res) => {
  try {
    const { shop } = req.query;
    const items = await ShopItem.find().lean();

    let filteredItems;
    if (shop === "weapon") {
      filteredItems = items.filter(
        (item) =>
          item.type === "Weapon" ||
          item.category === "Weapons" ||
          item.category === "MissileWeapons" ||
          item.category === "BluntWeapons" ||
          item.category === "LargeSwords" ||
          item.category === "ShortSwords" ||
          item.category === "KnivesAndDaggers" ||
          item.category === "Spears" ||
          item.category === "PoleArms" ||
          item.category === "Axes"
      );
    } else {
      filteredItems = items.filter(
        (item) =>
          item.type !== "Weapon" &&
          ![
            "Weapons",
            "MissileWeapons",
            "BluntWeapons",
            "LargeSwords",
            "ShortSwords",
            "KnivesAndDaggers",
            "Spears",
            "PoleArms",
            "Axes",
          ].includes(item.category)
      );
    }

    res.status(200).json(filteredItems);
  } catch (error) {
    console.error("Error fetching shop items:", error);
    res.status(500).json({
      message: "Failed to fetch shop items",
      error: error.message,
    });
  }
};

// Add a new shop item
export const addShopItem = async (req, res) => {
  const { name, description, price, category } = req.body;

  if (!name || !price || !category) {
    return res.status(400).json({
      message: "Name, price and category are required",
    });
  }

  try {
    const newItem = new ShopItem({ name, description, price, category });
    const savedItem = await newItem.save();
    res.status(201).json(savedItem);
  } catch (error) {
    console.error("Error adding shop item:", error);
    res.status(500).json({
      message: "Failed to add shop item",
      error: error.message,
    });
  }
};

// Update an existing shop item
export const updateShopItem = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  try {
    const updatedItem = await ShopItem.findByIdAndUpdate(id, updates, {
      new: true,
    });
    res.status(200).json(updatedItem);
  } catch {
    res.status(500).json({ message: "Failed to update shop item" });
  }
};

// Delete a shop item
export const deleteShopItem = async (req, res) => {
  const { id } = req.params;
  try {
    await ShopItem.findByIdAndDelete(id);
    res.status(200).json({ message: "Shop item deleted successfully" });
  } catch {
    res.status(500).json({ message: "Failed to delete shop item" });
  }
};

// Trade-in basic clothes for race-specific clothing
export const tradeInBasicClothes = async (req, res) => {
  try {
    console.log("🔄 DEBUG: Starting tradeInBasicClothes function");
    console.log("🔄 DEBUG: Request body:", req.body);

    const { characterId, selectedClothing } = req.body;
    console.log("🔄 DEBUG: Character ID:", characterId);
    console.log("🔄 DEBUG: Selected clothing:", selectedClothing);

    const character = await Character.findById(characterId);
    console.log("🔄 DEBUG: Found character:", character);

    if (!character) {
      console.log("❌ DEBUG: Character not found");
      return res.status(404).json({ message: "Character not found" });
    }

    // Ensure character has required fields
    if (!character.occ) {
      character.occ = character.class || "Adventurer";
    }

    // Ensure other common required fields exist
    if (!character.species) character.species = "Human";
    if (!character.class) character.class = "Adventurer";
    if (!character.level) character.level = 1;
    if (!character.hp) character.hp = 10;
    if (!character.alignment) character.alignment = "Neutral";
    if (!character.origin) character.origin = "Unknown";
    if (!character.socialBackground) character.socialBackground = "Unknown";
    if (!character.homeWorld) character.homeWorld = "Unknown";
    if (!character.gender) character.gender = "Unknown";
    if (!character.age) character.age = 20;
    if (!character.height) character.height = "5'6\"";
    if (!character.weight) character.weight = "150 lbs";

    // Ensure attributes map exists
    if (!character.attributes || typeof character.attributes !== "object") {
      character.attributes = {
        PS: 12,
        IQ: 12,
        ME: 12,
        MA: 12,
        PE: 12,
        PB: 12,
        Spd: 12,
        PP: 12,
      };
    }

    // Ensure skills array exists
    if (!character.skills || !Array.isArray(character.skills)) {
      character.skills = [];
    }

    // Ensure abilities array exists
    if (!character.abilities || !Array.isArray(character.abilities)) {
      character.abilities = [];
    }

    // Clean up existing inventory items - fix missing required fields and weights BEFORE any saves
    if (character.inventory && Array.isArray(character.inventory)) {
      character.inventory = character.inventory.map((item) => {
        const cleanedItem = {
          name: item.name || "Unknown Item",
          category: item.category || "Item",
          price: typeof item.price === "number" ? item.price : 0,
          description: item.description || "",
          damage: item.damage || "",
          weight: typeof item.weight === "number" ? item.weight : 0,
          length: item.length || "",
          handed: item.handed || "",
          type: item.type || "Item",
          defense: typeof item.defense === "number" ? item.defense : 0,
          effect: item.effect || "",
        };

        // Fix common weight issues
        if (cleanedItem.weight === 0 && cleanedItem.name) {
          if (cleanedItem.name.toLowerCase().includes("weapon")) {
            cleanedItem.weight = 2;
          } else if (cleanedItem.name.toLowerCase().includes("armor")) {
            cleanedItem.weight = 10;
          } else if (cleanedItem.name.toLowerCase().includes("clothing")) {
            cleanedItem.weight = 1;
          }
        }

        return cleanedItem;
      });
    } else {
      character.inventory = [];
    }

    // Ensure equipped object exists
    if (!character.equipped || typeof character.equipped !== "object") {
      character.equipped = {};
    }

    // Ensure wardrobe array exists
    if (!character.wardrobe || !Array.isArray(character.wardrobe)) {
      character.wardrobe = [];
    }

    // Find basic clothes in inventory
    console.log("🔄 DEBUG: Searching for basic clothes in inventory");
    console.log("🔄 DEBUG: Character inventory:", character.inventory);

    const basicClothesIndex = character.inventory.findIndex((item) => {
      console.log("🔄 DEBUG: Checking inventory item:", item);
      const itemName = item.name?.toLowerCase() || "";
      const isBasic =
        item.name &&
        (itemName.includes("basic clothes") ||
          itemName.includes("basic set of clothes") ||
          itemName.includes("set of clothes"));
      console.log("🔄 DEBUG: Item name:", item.name, "Is basic:", isBasic);
      return isBasic;
    });

    console.log("🔄 DEBUG: Basic clothes index:", basicClothesIndex);

    if (basicClothesIndex === -1) {
      console.log("❌ DEBUG: No basic clothes found in inventory");
      return res
        .status(400)
        .json({ message: "No basic clothes found in inventory" });
    }

    // Remove the basic clothes
    console.log(
      "🔄 DEBUG: Removing basic clothes at index:",
      basicClothesIndex
    );
    character.inventory.splice(basicClothesIndex, 1);
    console.log(
      "🔄 DEBUG: Inventory after removing basic clothes:",
      character.inventory
    );

    // Add the selected race-specific clothing
    console.log("🔄 DEBUG: Adding selected clothing:", selectedClothing);
    const raceClothingProperties = {
      "Cloth Hood": { slot: "head", type: "clothing", weight: 0.5, price: 5 },
      "Wool Tunic": { slot: "torso", type: "clothing", weight: 1, price: 10 },
      "Leather Breeches": {
        slot: "legs",
        type: "clothing",
        weight: 1.5,
        price: 15,
      },
      "Sturdy Boots": { slot: "feet", type: "clothing", weight: 2, price: 12 },
      "Linen Gloves": {
        slot: "hands",
        type: "clothing",
        weight: 0.3,
        price: 5,
      },
      "Fur Hood": { slot: "head", type: "clothing", weight: 0.8, price: 8 },
      "Hide Tunic": { slot: "torso", type: "clothing", weight: 1.5, price: 12 },
      "Hide Boots": { slot: "feet", type: "clothing", weight: 2.5, price: 15 },
      "Fur Wraps": { slot: "hands", type: "clothing", weight: 0.6, price: 8 },
      "Silk Hood": { slot: "head", type: "clothing", weight: 0.3, price: 25 },
      "Silk Tunic": { slot: "torso", type: "clothing", weight: 0.8, price: 50 },
      "Fine Breeches": { slot: "legs", type: "clothing", weight: 1, price: 30 },
      "Soft Boots": { slot: "feet", type: "clothing", weight: 1.5, price: 20 },
      "Silk Gloves": {
        slot: "hands",
        type: "clothing",
        weight: 0.2,
        price: 15,
      },
      "Wool Cap": { slot: "head", type: "clothing", weight: 0.5, price: 8 },
      "Heavy Tunic": { slot: "torso", type: "clothing", weight: 2, price: 15 },
      "Wool Breeches": { slot: "legs", type: "clothing", weight: 2, price: 18 },
      "Heavy Boots": { slot: "feet", type: "clothing", weight: 3, price: 20 },
      "Leather Gloves": {
        slot: "hands",
        type: "clothing",
        weight: 0.5,
        price: 8,
      },
      "Colorful Cap": {
        slot: "head",
        type: "clothing",
        weight: 0.4,
        price: 12,
      },
      "Fine Tunic": { slot: "torso", type: "clothing", weight: 1.2, price: 18 },
      "Light Breeches": {
        slot: "legs",
        type: "clothing",
        weight: 1,
        price: 12,
      },
      "Soft Shoes": { slot: "feet", type: "clothing", weight: 1, price: 10 },
      "Fine Gloves": {
        slot: "hands",
        type: "clothing",
        weight: 0.3,
        price: 10,
      },
      "Rough Hood": { slot: "head", type: "clothing", weight: 1, price: 6 },
      "Coarse Tunic": { slot: "torso", type: "clothing", weight: 2, price: 12 },
      "Coarse Boots": { slot: "feet", type: "clothing", weight: 3, price: 18 },
      "Leather Wraps": {
        slot: "hands",
        type: "clothing",
        weight: 0.8,
        price: 6,
      },
      "Hide Cap": { slot: "head", type: "clothing", weight: 1.2, price: 8 },
      "Fungus Hood": { slot: "head", type: "clothing", weight: 0.6, price: 10 },
      "Cave Silk Tunic": {
        slot: "torso",
        type: "clothing",
        weight: 1,
        price: 25,
      },
      "Fungus Breeches": {
        slot: "legs",
        type: "clothing",
        weight: 1.2,
        price: 15,
      },
      "Cloth Wraps": { slot: "hands", type: "clothing", weight: 0.4, price: 5 },
      "Metal Cap": { slot: "head", type: "clothing", weight: 1.5, price: 15 },
      "Metal Bracers": {
        slot: "hands",
        type: "clothing",
        weight: 1.5,
        price: 20,
      },
      "Patchwork Cap": {
        slot: "head",
        type: "clothing",
        weight: 0.8,
        price: 5,
      },
      "Patchwork Tunic": {
        slot: "torso",
        type: "clothing",
        weight: 1.8,
        price: 8,
      },
      "Military Cap": { slot: "head", type: "clothing", weight: 1, price: 12 },
      "Military Tunic": {
        slot: "torso",
        type: "clothing",
        weight: 2,
        price: 15,
      },
      "Adaptive Hood": {
        slot: "head",
        type: "clothing",
        weight: 0.5,
        price: 30,
      },
      "Adaptive Tunic": {
        slot: "torso",
        type: "clothing",
        weight: 1,
        price: 40,
      },
      "Adaptive Breeches": {
        slot: "legs",
        type: "clothing",
        weight: 1,
        price: 30,
      },
      "Adaptive Boots": {
        slot: "feet",
        type: "clothing",
        weight: 1.5,
        price: 35,
      },
      "Adaptive Gloves": {
        slot: "hands",
        type: "clothing",
        weight: 0.3,
        price: 25,
      },
    };

    console.log(
      "🔄 DEBUG: Looking up clothing properties for:",
      selectedClothing
    );
    const clothingProps = raceClothingProperties[selectedClothing];
    console.log("🔄 DEBUG: Found clothing properties:", clothingProps);

    if (!clothingProps) {
      console.log("❌ DEBUG: Invalid clothing selection - no properties found");
      return res.status(400).json({ message: "Invalid clothing selection" });
    }

    const newClothing = {
      name: selectedClothing,
      type: clothingProps.type,
      slot: clothingProps.slot,
      weight: clothingProps.weight,
      price: clothingProps.price,
      category: "Clothing",
      description: `Traditional ${character.species.toLowerCase()} clothing`,
    };

    console.log("🔄 DEBUG: Created new clothing item:", newClothing);

    // Add to wardrobe instead of inventory for equipment system
    console.log("🔄 DEBUG: Adding clothing to wardrobe");
    console.log("🔄 DEBUG: Wardrobe before:", character.wardrobe);
    character.wardrobe.push(newClothing);
    console.log("🔄 DEBUG: Wardrobe after:", character.wardrobe);

    // Validate character before saving
    try {
      console.log("🔄 DEBUG: Saving character...");
      await character.save();
      console.log("✅ DEBUG: Character saved successfully");
    } catch (validationError) {
      console.error("❌ DEBUG: Character validation error:", validationError);
      console.error(
        "❌ DEBUG: Character data:",
        JSON.stringify(character, null, 2)
      );
      return res.status(400).json({
        message: "Character validation failed",
        error: validationError.message,
        details: validationError.errors,
      });
    }

    console.log("✅ DEBUG: Sending success response");
    res.json({
      message: `Basic clothes traded in for ${selectedClothing}!`,
      character: character,
    });
  } catch (error) {
    console.error("❌ DEBUG: Trade-in error:", error);
    console.error("❌ DEBUG: Error message:", error.message);
    console.error("❌ DEBUG: Error stack:", error.stack);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Trade-in starting equipment for OCC-specific gear
export const tradeInStartingEquipment = async (req, res) => {
  try {
    console.log("🔄 DEBUG: Starting tradeInStartingEquipment function");
    console.log("🔄 DEBUG: Request body:", req.body);

    const { characterId, tradeInItems, selectedAlternatives } = req.body;
    console.log("🔄 DEBUG: Character ID:", characterId);
    console.log("🔄 DEBUG: Trade-in items:", tradeInItems);
    console.log("🔄 DEBUG: Selected alternatives:", selectedAlternatives);

    const character = await Character.findById(characterId);
    console.log("🔄 DEBUG: Found character:", character);

    if (!character) {
      console.log("❌ DEBUG: Character not found");
      return res.status(404).json({ message: "Character not found" });
    }

    if (!character.occ) {
      console.log("❌ DEBUG: Character missing OCC");
      return res.status(400).json({
        message: "Character must have an OCC to trade in starting equipment",
      });
    }

    // Ensure character has required fields
    if (!character.occ) {
      character.occ = character.class || "Adventurer";
    }

    // Ensure other common required fields exist
    if (!character.species) character.species = "Human";
    if (!character.class) character.class = "Adventurer";
    if (!character.level) character.level = 1;
    if (!character.hp) character.hp = 10;
    if (!character.alignment) character.alignment = "Neutral";
    if (!character.origin) character.origin = "Unknown";
    if (!character.socialBackground) character.socialBackground = "Unknown";
    if (!character.homeWorld) character.homeWorld = "Unknown";
    if (!character.gender) character.gender = "Unknown";
    if (!character.age) character.age = 20;
    if (!character.height) character.height = "5'6\"";
    if (!character.weight) character.weight = "150 lbs";

    // Ensure attributes map exists
    if (!character.attributes || typeof character.attributes !== "object") {
      character.attributes = {
        PS: 12,
        IQ: 12,
        ME: 12,
        MA: 12,
        PE: 12,
        PB: 12,
        Spd: 12,
        PP: 12,
      };
    }

    // Ensure skills array exists
    if (!character.skills || !Array.isArray(character.skills)) {
      character.skills = [];
    }

    // Ensure abilities array exists
    if (!character.abilities || !Array.isArray(character.abilities)) {
      character.abilities = [];
    }

    // Clean up existing inventory items - fix missing required fields and weights BEFORE any saves
    if (character.inventory && Array.isArray(character.inventory)) {
      character.inventory = character.inventory.map((item) => {
        const cleanedItem = {
          name: item.name || "Unknown Item",
          category: item.category || "Item",
          price: typeof item.price === "number" ? item.price : 0,
          description: item.description || "",
          damage: item.damage || "",
          weight: typeof item.weight === "number" ? item.weight : 0,
          length: item.length || "",
          handed: item.handed || "",
          type: item.type || "Item",
          defense: typeof item.defense === "number" ? item.defense : 0,
          effect: item.effect || "",
        };

        // Fix common weight issues
        if (cleanedItem.weight === 0 && cleanedItem.name) {
          if (cleanedItem.name.toLowerCase().includes("weapon")) {
            cleanedItem.weight = 2;
          } else if (cleanedItem.name.toLowerCase().includes("armor")) {
            cleanedItem.weight = 10;
          } else if (cleanedItem.name.toLowerCase().includes("clothing")) {
            cleanedItem.weight = 1;
          }
        }

        return cleanedItem;
      });
    } else {
      character.inventory = [];
    }

    // Ensure equipped object exists
    if (!character.equipped || typeof character.equipped !== "object") {
      character.equipped = {};
    }

    // Ensure wardrobe array exists
    if (!character.wardrobe || !Array.isArray(character.wardrobe)) {
      character.wardrobe = [];
    }

    console.log("🔄 DEBUG: Processing trade-in items");

    // Calculate total trade-in value
    let totalTradeInValue = 0;

    // Remove trade-in items from inventory
    tradeInItems.forEach((tradeInItem) => {
      console.log("🔄 DEBUG: Removing trade-in item:", tradeInItem);

      const itemIndex = character.inventory.findIndex(
        (item) => item.name === tradeInItem.name
      );

      if (itemIndex !== -1) {
        character.inventory.splice(itemIndex, 1);
        totalTradeInValue += getStartingEquipmentTradeInValue(tradeInItem.name);
      }
    });

    console.log("🔄 DEBUG: Total trade-in value:", totalTradeInValue);

    // Add selected alternatives to character
    selectedAlternatives.forEach((alternative) => {
      console.log("🔄 DEBUG: Adding alternative:", alternative);

      const newItem = {
        name: alternative.name,
        category: alternative.category || "Equipment",
        type: alternative.type || "Item",
        weight: alternative.weight || 0,
        price: alternative.price || 0,
        description: alternative.description || "",
        slot: alternative.slot || "misc",
        armorRating: alternative.armorRating || 0,
        sdc: alternative.sdc || 0,
        currentSDC: alternative.sdc || 0,
        broken: false,
      };

      // Add to appropriate location based on category
      if (alternative.category === "wardrobe") {
        character.wardrobe.push(newItem);
      } else {
        // Put all other items in inventory so player can choose what to equip
        character.inventory.push(newItem);
      }
    });

    // Add trade-in value to character's gold
    character.gold = (character.gold || 0) + totalTradeInValue;

    // Validate character before saving
    try {
      console.log("🔄 DEBUG: Saving character...");
      await character.save();
      console.log("✅ DEBUG: Character saved successfully");
    } catch (validationError) {
      console.error("❌ DEBUG: Character validation error:", validationError);
      console.error(
        "❌ DEBUG: Character data:",
        JSON.stringify(character, null, 2)
      );
      return res.status(400).json({
        message: "Character validation failed",
        error: validationError.message,
        details: validationError.errors,
      });
    }

    console.log("✅ DEBUG: Sending success response");
    res.json({
      message: `Starting equipment traded in for ${selectedAlternatives.length} OCC-specific items! (+${totalTradeInValue} gold)`,
      character: character,
      tradeInValue: totalTradeInValue,
    });
  } catch (error) {
    console.error("❌ DEBUG: Starting equipment trade-in error:", error);
    console.error("❌ DEBUG: Error message:", error.message);
    console.error("❌ DEBUG: Error stack:", error.stack);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Helper function to get trade-in value for starting equipment
function getStartingEquipmentTradeInValue(itemName) {
  const tradeInValues = {
    "Basic set of clothes": 5,
    "Set of clothes": 5,
    Boots: 3,
    Belt: 2,
    Sack: 2,
    "Large sack": 4,
    "Small sack": 2,
    Backpack: 8,
    Knapsack: 6,
    Club: 2,
    Dagger: 3,
    Knife: 2,
    "Low quality weapon": 5,
  };

  return tradeInValues[itemName] || 1;
}

// Trade-in low quality weapon for a selected weapon
export const tradeInLowQualityWeapon = async (req, res) => {
  try {
    const { characterId, selectedWeapon } = req.body;

    const character = await Character.findById(characterId);
    if (!character) {
      return res.status(404).json({ message: "Character not found" });
    }

    // Ensure character has required fields (fix for legacy characters)
    if (!character.occ) {
      character.occ = character.class || "Adventurer";
    }

    // Ensure other common required fields exist
    if (!character.species) character.species = "Human";
    if (!character.class) character.class = "Adventurer";
    if (!character.level) character.level = 1;
    if (!character.hp) character.hp = 10;
    if (!character.alignment) character.alignment = "Neutral";
    if (!character.origin) character.origin = "Unknown";
    if (!character.socialBackground) character.socialBackground = "Unknown";
    if (!character.homeWorld) character.homeWorld = "Unknown";
    if (!character.gender) character.gender = "Unknown";
    if (!character.age) character.age = 20;
    if (!character.height) character.height = "5'6\"";
    if (!character.weight) character.weight = "150 lbs";

    // Ensure attributes map exists
    if (!character.attributes || typeof character.attributes !== "object") {
      character.attributes = {
        PS: 12,
        IQ: 12,
        ME: 12,
        MA: 12,
        PE: 12,
        PB: 12,
        Spd: 12,
        PP: 12,
      };
    }

    // Ensure skills array exists
    if (!character.skills || !Array.isArray(character.skills)) {
      character.skills = [];
    }

    // Ensure abilities array exists
    if (!character.abilities || !Array.isArray(character.abilities)) {
      character.abilities = [];
    }

    // Clean up existing inventory items - fix missing required fields and weights BEFORE any saves
    character.inventory.forEach((inventoryItem) => {
      // Ensure required fields exist
      if (!inventoryItem.name) inventoryItem.name = "Unknown Item";
      if (!inventoryItem.category) inventoryItem.category = "Misc";
      if (!inventoryItem.type) inventoryItem.type = "Item";

      // Ensure type is valid enum value
      const validTypes = ["Weapon", "Item", "weapon", "armor", "consumable"];
      if (!validTypes.includes(inventoryItem.type)) {
        inventoryItem.type = "Item";
      }

      // Convert string weights to numbers
      if (inventoryItem.weight && typeof inventoryItem.weight === "string") {
        const parseWeight = (weightValue) => {
          if (typeof weightValue === "number") return weightValue;
          if (typeof weightValue === "string") {
            // Handle various weight formats
            if (weightValue === "N/A") return 0;
            const match = weightValue.match(/(\d+\.?\d*)/);
            return match ? parseFloat(match[1]) : 0;
          }
          return 0;
        };
        inventoryItem.weight = parseWeight(inventoryItem.weight);
      }
    });

    // Validate selected weapon
    const validWeapons = [
      "Sling",
      "Stone Axe",
      "Dagger",
      "Throwing Axe",
      "Meat Cleaver",
      "Shovel",
    ];
    if (!selectedWeapon || !validWeapons.includes(selectedWeapon)) {
      return res.status(400).json({
        message:
          "Invalid weapon selection. Please choose from: Sling, Stone Axe, Dagger, Throwing Axe, Meat Cleaver, or Shovel",
      });
    }

    // Find a low quality weapon in inventory
    const lowQualityWeaponIndex = character.inventory.findIndex(
      (item) =>
        item.name && item.name.toLowerCase().includes("low quality weapon")
    );

    if (lowQualityWeaponIndex === -1) {
      return res
        .status(400)
        .json({ message: "No low quality weapon found in inventory" });
    }

    // Remove the low quality weapon
    character.inventory.splice(lowQualityWeaponIndex, 1);

    // Add the selected weapon to inventory
    const weaponProperties = {
      Sling: { category: "ranged", weight: 1, price: 5, damage: "1d4" },
      "Stone Axe": {
        category: "one-handed",
        weight: 4,
        price: 8,
        damage: "1d6",
      },
      Dagger: { category: "one-handed", weight: 2, price: 15, damage: "1d4" },
      "Throwing Axe": {
        category: "thrown",
        weight: 3,
        price: 15,
        damage: "1d6",
      },
      "Meat Cleaver": {
        category: "one-handed",
        weight: 3,
        price: 6,
        damage: "1d4",
      },
      Shovel: { category: "two-handed", weight: 8, price: 4, damage: "1d4" },
    };

    const weaponProps = weaponProperties[selectedWeapon];
    const newWeapon = {
      name: selectedWeapon,
      type: "weapon",
      category: weaponProps.category,
      weight: weaponProps.weight,
      price: weaponProps.price,
      damage: weaponProps.damage,
    };

    character.inventory.push(newWeapon);

    // Validate character before saving
    try {
      await character.save();
    } catch (validationError) {
      console.error("Character validation error:", validationError);
      console.error("Character data:", JSON.stringify(character, null, 2));
      return res.status(400).json({
        message: "Character validation failed",
        error: validationError.message,
        details: validationError.errors,
      });
    }

    res.json({
      message: `Low quality weapon traded in for ${selectedWeapon}!`,
      character: character,
    });
  } catch (error) {
    console.error("Trade-in error:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      characterId: req.body.characterId,
    });
    res.status(500).json({
      message: "Failed to trade in weapon",
      error: error.message,
    });
  }
};

export const purchaseItem = async (req, res) => {
  try {
    const { itemId, characterId } = req.body;

    const character = await Character.findById(characterId);
    if (!character) {
      return res.status(404).json({ message: "Character not found" });
    }

    // Ensure character has required fields (fix for legacy characters)
    if (!character.occ) {
      character.occ = character.class || "Adventurer";
      await character.save();
    }

    let item = await Weapon.findOne({ itemId: itemId });
    let isWeapon = true;

    if (!item) {
      item = await ShopItem.findOne({ itemId: itemId });
      isWeapon = false;
    }

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    if (character.gold < item.price) {
      return res.status(400).json({ message: "Not enough gold" });
    }

    // Parse weight from string to number - extract numeric value from strings like "2.5lb", "1.1kg"
    const parseWeight = (weightValue) => {
      if (typeof weightValue === "number") return weightValue;
      if (typeof weightValue === "string") {
        const match = weightValue.match(/(\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : 0;
      }
      return 0;
    };

    const inventoryItem = isWeapon
      ? {
          name: item.name,
          category: item.category,
          price: item.price,
          description: item.description || "",
          damage: item.damage,
          weight: parseWeight(item.weight),
          length: item.length || "",
          handed: item.handed || "",
          type: "Weapon",
        }
      : {
          name: item.name,
          category: item.category,
          price: item.price,
          description: item.description || "",
          weight: parseWeight(item.weight),
          type: "Item",
        };

    character.inventory.push(inventoryItem);
    character.gold -= item.price;

    // If this is a weapon and character has no equipped weapon, auto-equip it
    if (isWeapon && !character.equippedWeapon) {
      character.equippedWeapon = item.name;
    }

    // Clean up existing inventory items - fix missing required fields and weights
    character.inventory.forEach((inventoryItem) => {
      // Ensure required fields exist
      if (!inventoryItem.name) inventoryItem.name = "Unknown Item";
      if (!inventoryItem.category) inventoryItem.category = "Misc";
      if (!inventoryItem.type) inventoryItem.type = "Item";

      // Ensure type is valid enum value
      const validTypes = ["Weapon", "Item", "weapon", "armor", "consumable"];
      if (!validTypes.includes(inventoryItem.type)) {
        inventoryItem.type = "Item";
      }

      // Convert string weights to numbers
      if (inventoryItem.weight && typeof inventoryItem.weight === "string") {
        const parseWeight = (weightValue) => {
          if (typeof weightValue === "number") return weightValue;
          if (typeof weightValue === "string") {
            // Handle various weight formats
            if (weightValue === "N/A") return 0;
            const match = weightValue.match(/(\d+\.?\d*)/);
            return match ? parseFloat(match[1]) : 0;
          }
          return 0;
        };
        inventoryItem.weight = parseWeight(inventoryItem.weight);
      }
    });

    await character.save();

    res.status(200).json({
      message: `Successfully purchased ${item.name}`,
      character: character,
    });
  } catch (error) {
    console.error("Purchase error:", error);
    res.status(500).json({
      message: "Failed to complete purchase",
      error: error.message,
    });
  }
};

// Seed shop items
export const seedShopItems = async (req, res) => {
  try {
    const existingItems = await ShopItem.find();
    console.log("Existing items count:", existingItems.length);

    if (existingItems.length === 0) {
      // TODO: Replace with proper weapon data source
      const weapons = []; // weaponShop.getItems().map((weapon) => ({ ... }));

      console.log("Weapons to add:", weapons.length);

      const formattedItems = [
        ...weapons,
        ...items.map((item) => ({
          itemId: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          category: item.category,
        })),
      ];

      console.log("Total items to seed:", formattedItems.length);

      await ShopItem.insertMany(formattedItems);
      console.log("Items seeded successfully");
    }

    res.status(200).json({ message: "Shop items checked/seeded successfully" });
  } catch (error) {
    console.error("Error seeding shop items:", error);
    res.status(500).json({
      message: "Failed to seed shop items",
      error: error.message,
    });
  }
};

export const getWeapons = async (req, res) => {
  try {
    const weapons = await Weapon.find({});
    res.status(200).json(weapons);
  } catch (error) {
    console.error("Error fetching weapons:", error);
    res.status(500).json({
      message: "Failed to fetch weapons",
      error: error.message,
    });
  }
};
