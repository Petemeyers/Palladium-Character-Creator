/* eslint-env node */
import express from "express";
import {
  login,
  register,
  refreshToken,
  requestPasswordReset,
  resetPassword,
} from "../controllers/userController.js";

const router = express.Router();

router.post("/login", login);
router.post("/register", register);
router.post("/refresh-token", refreshToken);
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);

export default router;
