import express from "express";
import {
  getShopItems,
  addShopItem,
  updateShopItem,
  deleteShopItem,
  purchaseItem,
  seedShopItems,
  getWeapons,
  tradeInLowQualityWeapon,
  tradeInBasicClothes,
  tradeInStartingEquipment,
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

// Trade-in routes
router.post("/trade-in-low-quality", authenticateToken, tradeInLowQualityWeapon);
router.post("/trade-in-basic-clothes", authenticateToken, tradeInBasicClothes);
router.post("/trade-in-starting-equipment", authenticateToken, tradeInStartingEquipment);

export default router;
