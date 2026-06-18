import express from "express";
import {
  getCombatState,
  moveCombatFighter,
} from "../conchampioners/combatConchampioner.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/state", authenticateToken, getCombatState);
router.post("/fighters/:fighterId/move", authenticateToken, moveCombatFighter);

export default router;
