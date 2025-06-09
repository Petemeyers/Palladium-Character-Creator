import express from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import {
  createParty,
  getParties,
  updateParty,
  deleteParty,
} from "../controllers/partyController.js";

const router = express.Router();

router.use(authenticateToken);

router.post("/", createParty);
router.get("/", getParties);
router.put("/:id", updateParty);
router.delete("/:id", deleteParty);

export default router;
