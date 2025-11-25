import express from "express";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Get merchant inventory
router.get("/:merchantId/inventory", authenticateToken, async (req, res) => {
  try {
    // TODO: Implement merchant inventory retrieval
    res.json({ items: [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Buy from merchant
router.post("/:merchantId/buy", authenticateToken, async (req, res) => {
  try {
    // TODO: Implement buy transaction
    res.json({ message: "Purchase completed" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Sell to merchant
router.post("/:merchantId/sell", authenticateToken, async (req, res) => {
  try {
    // TODO: Implement sell transaction
    res.json({ message: "Sale completed" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;

