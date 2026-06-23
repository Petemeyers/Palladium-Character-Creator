import express from "express";
import { getActiveSession } from "../controllers/sessionController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/active", authenticateToken, getActiveSession);

export default router;
