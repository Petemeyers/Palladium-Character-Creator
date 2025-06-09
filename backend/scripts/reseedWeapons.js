import mongoose from "mongoose";
import dotenv from "dotenv";
import process from "process";
import Weapon from "../models/Weapon.js";
import { weapons } from "../weaponShop.js";

dotenv.config();

const reseedWeapons = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    await Weapon.deleteMany({});
    console.log("Cleared existing weapons");

    // Track used itemIds to prevent duplicates
    const usedItemIds = new Set();
    const uniqueWeapons = [];

    weapons.forEach((weapon) => {
      if (!usedItemIds.has(weapon.itemId)) {
        usedItemIds.add(weapon.itemId);
        uniqueWeapons.push({
          itemId: weapon.itemId,
          name: weapon.name,
          type: weapon.type || "Weapon",
          category: weapon.category.replace(/\s+/g, ""), // Remove spaces from category
          price: weapon.price || weapon.cost,
          damage: weapon.damage,
          weight: weapon.weight,
          length: weapon.length,
          handed: weapon.handed,
          description: weapon.description,
        });
      } else {
        console.log(`Skipping duplicate weapon with itemId: ${weapon.itemId}`);
      }
    });

    console.log(`Processing ${uniqueWeapons.length} unique weapons`);
    const result = await Weapon.insertMany(uniqueWeapons);
    console.log(`Successfully added ${result.length} weapons`);

    await mongoose.connection.close();
    console.log("Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("Error reseeding weapons:", error);
    process.exit(1);
  }
};

reseedWeapons();
