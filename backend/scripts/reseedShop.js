import mongoose from "mongoose";
import dotenv from "dotenv";
import ShopItem from "../models/ShopItem.js";
import items from "../items.js";
import weaponShop from "../weaponShop.js";
import process from "process";

dotenv.config();

const reseedShop = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    await ShopItem.deleteMany({});
    console.log("Cleared existing items");

    const weapons = weaponShop.getItems();
    console.log("Weapons to add:", weapons.length);

    const existingItemIds = new Set();

    // Validate and format weapons
    const formattedWeapons = weapons
      .filter((weapon) => {
        // Check required fields
        if (!weapon.id || !weapon.price) {
          console.log("Invalid weapon:", weapon);
          return false;
        }
        if (existingItemIds.has(weapon.id)) {
          console.log(`Skipping duplicate weapon ID: ${weapon.id}`);
          return false;
        }
        existingItemIds.add(weapon.id);
        return true;
      })
      .map((weapon) => ({
        itemId: weapon.id.toString(),
        name: weapon.name,
        type: weapon.type || "Weapon",
        category: weapon.category,
        price: weapon.price,
      }));

    // Validate and format items
    const formattedItems = items
      .filter((item) => {
        // Check required fields
        if (!item.id || !item.price) {
          console.log("Invalid item:", item);
          return false;
        }
        if (existingItemIds.has(item.id)) {
          console.log(`Skipping duplicate item ID: ${item.id}`);
          return false;
        }
        existingItemIds.add(item.id);
        return true;
      })
      .map((item) => ({
        itemId: item.id.toString(),
        name: item.name,
        type: item.type || "Item",
        category: item.category,
        price: item.price,
      }));

    const allItems = [...formattedWeapons, ...formattedItems];
    console.log("Valid items to insert:", allItems.length);

    const result = await ShopItem.insertMany(allItems);
    console.log(`Successfully added ${result.length} shop items`);

    process.exit(0);
  } catch (error) {
    console.error("Error reseeding shop:", error);
    process.exit(1);
  }
};

reseedShop();
