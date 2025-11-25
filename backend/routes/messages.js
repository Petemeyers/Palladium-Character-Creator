import express from "express";
import Message from "../models/Message.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Get all messages
router.get("/", authenticateToken, async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 }).limit(100);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new message
router.post("/", authenticateToken, async (req, res) => {
  try {
    const message = new Message({
      ...req.body,
      user: req.user.id,
    });
    await message.save();
    res.status(201).json(message);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a message
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    if (message.user.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }
    await Message.findByIdAndDelete(req.params.id);
    res.json({ message: "Message deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

