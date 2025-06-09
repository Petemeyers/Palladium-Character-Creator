import express from "express";
import { handleChat, chatLimiter } from "../controllers/chatController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", authenticateToken, chatLimiter, handleChat);

export default router;
