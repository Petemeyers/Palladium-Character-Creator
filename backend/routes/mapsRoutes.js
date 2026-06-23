import express from "express";
import {
  commitActiveMap,
  getActiveMap,
} from "../controllers/mapsController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/active", authenticateToken, getActiveMap);
router.post("/active/commit", authenticateToken, commitActiveMap);

export default router;
