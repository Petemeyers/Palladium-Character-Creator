import express from "express";
import Weapon from "../models/Weapon.js";
import auth from "../middleware/auth.js";
import { palladiumWeapons } from "../../src/data/palladiumWeapons.js";

const router = express.Router();

// Add auth middleware to all routes except populate, test, and ping endpoints
router.use((req, res, next) => {
  if (
    req.path === "/populate" ||
    req.path === "/test" ||
    req.path === "/ping"
  ) {
    // Skip auth for populate, test, and ping endpoints
    next();
  } else {
    auth(req, res, next);
  }
});

// GET all weapons
router.get("/", async (req, res) => {
  try {
    const weapons = await Weapon.find({});
    res.status(200).json(weapons);
  } catch (error) {
    console.error("Error fetching weapons:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching weapons",
      error: error.message,
    });
  }
});

// POST route to populate weapons database
router.post("/populate", async (req, res) => {
  try {
    console.log("🚀 Starting weapon database population...");
    console.log("📊 Palladium weapons count:", palladiumWeapons.length);

    // Clear existing weapons
    const deleteResult = await Weapon.deleteMany({});
    console.log(`🗑️ Cleared ${deleteResult.deletedCount} existing weapons`);

    // Add all Palladium weapons
    const weaponsToAdd = palladiumWeapons.map((weapon, index) => ({
      itemId: `weapon_${index + 1}`,
      name: weapon.name,
      type: weapon.type,
      category: weapon.category,
      price: weapon.price,
      damage: weapon.damage,
      weight: weapon.weight,
      length: weapon.length,
      handed: weapon.handed,
      description: weapon.description,
      reach: weapon.reach,
      range: weapon.range,
      rateOfFire: weapon.rateOfFire,
      ammunition: weapon.ammunition,
      strengthRequired: weapon.strengthRequired,
      notes: weapon.notes,
    }));

    const result = await Weapon.insertMany(weaponsToAdd);
    console.log(`✅ Added ${result.length} weapons to database`);

    // Log categories
    const categories = [...new Set(result.map((w) => w.category))];
    console.log(`📊 Categories: ${categories.join(", ")}`);

    res.status(200).json({
      success: true,
      message: `Successfully added ${result.length} weapons to database`,
      categories: categories,
      weaponCount: result.length,
    });
  } catch (error) {
    console.error("❌ Error populating weapons:", error);
    res.status(500).json({
      success: false,
      message: "Error populating weapons database",
      error: error.message,
    });
  }
});

// GET test endpoint (no auth required)
router.get("/test", async (req, res) => {
  try {
    console.log("🔍 Test endpoint called");
    const weapons = await Weapon.find({});
    console.log(`📊 Found ${weapons.length} weapons in database`);
    res.status(200).json({
      success: true,
      count: weapons.length,
      categories: [...new Set(weapons.map((w) => w.category))],
      sample: weapons.slice(0, 5),
    });
  } catch (error) {
    console.error("Error fetching weapons:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching weapons",
      error: error.message,
    });
  }
});

// GET simple test endpoint
router.get("/ping", (req, res) => {
  console.log("🏓 Ping endpoint called");
  res.status(200).json({
    message: "Weapon routes are working!",
    timestamp: new Date().toISOString(),
  });
});

export default router;
