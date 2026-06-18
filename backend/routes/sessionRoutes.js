import express from "express";
import { getActiveSession } from "../conchampioners/sessionConchampioner.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/active", authenticateToken, getActiveSession);

export default router;
