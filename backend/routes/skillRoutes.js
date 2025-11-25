import express from "express";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Get all skills
router.get("/", authenticateToken, async (req, res) => {
  try {
    // TODO: Implement skill retrieval
    res.json([]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get skill by name
router.get("/:skillName", authenticateToken, async (req, res) => {
  try {
    // TODO: Implement skill retrieval
    res.status(404).json({ error: "Skill not found" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update character skill
router.put("/character/:characterId/:skillName", authenticateToken, async (req, res) => {
  try {
    // TODO: Implement skill update
    res.json({ message: "Skill updated" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;

