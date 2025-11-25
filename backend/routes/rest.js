import express from "express";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Rest party/characters
router.post("/", authenticateToken, async (req, res) => {
  try {
    // TODO: Implement rest mechanics (healing, spell recovery, etc.)
    res.json({ message: "Rest completed" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get rest status
router.get("/status", authenticateToken, async (req, res) => {
  try {
    // TODO: Implement rest status check
    res.json({ canRest: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

