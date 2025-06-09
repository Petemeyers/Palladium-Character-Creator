import express from "express";
import {
  getShopItems,
  addShopItem,
  updateShopItem,
  deleteShopItem,
  purchaseItem,
  seedShopItems,
  getWeapons,
} from "../controllers/shopController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Routes
router.get("/items", authenticateToken, getShopItems);
router.get("/weapons", authenticateToken, getWeapons);
router.post("/purchase", authenticateToken, purchaseItem);
router.post("/items", authenticateToken, addShopItem);
router.put("/items/:id", authenticateToken, updateShopItem);
router.delete("/items/:id", authenticateToken, deleteShopItem);
router.post("/seed", authenticateToken, seedShopItems);

export default router;
