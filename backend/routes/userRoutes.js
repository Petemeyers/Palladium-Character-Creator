/* eslint-env node */
import express from "express";
import {
  login,
  register,
  refreshToken,
} from "../controllers/userController.js";

const router = express.Router();

router.post("/login", login);
router.post("/register", register);
router.post("/refresh-token", refreshToken);

export default router;
