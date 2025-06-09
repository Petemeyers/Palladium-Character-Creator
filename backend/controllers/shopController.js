import ShopItem from "../models/ShopItem.js";
import Character from "../models/Character.js";
import items from "../items.js";
import weaponShop from "../weaponShop.js";
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

export const purchaseItem = async (req, res) => {
  try {
    const { itemId, characterId } = req.body;

    const character = await Character.findById(characterId);
    if (!character) {
      return res.status(404).json({ message: "Character not found" });
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

    const inventoryItem = isWeapon
      ? {
          name: item.name,
          category: item.category,
          price: item.price,
          description: item.description || "",
          damage: item.damage,
          weight: item.weight,
          length: item.length,
          handed: item.handed,
          type: "Weapon",
        }
      : {
          name: item.name,
          category: item.category,
          price: item.price,
          description: item.description || "",
          type: "Item",
        };

    character.inventory.push(inventoryItem);
    character.gold -= item.price;

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
      const weapons = weaponShop.getItems().map((weapon) => ({
        itemId: weapon.id,
        name: weapon.name,
        description:
          weapon.description || `${weapon.handed} ${weapon.category} weapon`,
        price: weapon.price,
        category: weapon.category,
        damage: weapon.damage,
        weight: weapon.weight,
        length: weapon.length,
        type: weapon.type,
        handed: weapon.handed,
      }));

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
