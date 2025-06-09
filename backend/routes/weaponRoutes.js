import express from "express";
import Weapon from "../models/Weapon.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// Add auth middleware to all routes
router.use(auth);

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

export default router;
