import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import { specs } from "./swagger.js";
import shopRoutes from "./routes/shopRoutes.js";
import characterRoutes from "./routes/characterRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import partyRoutes from "./routes/partyRoutes.js";
import messageRoutes from "./routes/messages.js";
import npcRoutes from "./routes/npc.js";
import npcMemoryRoutes from "./routes/npcMemory.js";
import combatLogRoutes from "./routes/combatLog.js";
import restRoutes from "./routes/rest.js";
import lootRoutes from "./routes/loot.js";
import merchantRoutes from "./routes/merchant.js";
import openaiRoutes from "./routes/openai.js";
import questRoutes from "./routes/quest.js";
import skillRoutes from "./routes/skillRoutes.js";
import armorRoutes from "./routes/armorRoutes.js";
import weaponRoutes from "./routes/weaponRoutes.js";

// GM-RAG imports
import systemGM from "./server/prompt/systemGM.js";
import { buildVectors } from "./server/rag/embed.js";
import { retrieveContext } from "./server/rag/retriever.js";
import { roll } from "./server/tools/dice.js";
import { listStarts, randomStart } from "./server/tools/mapStarts.js";
import process from "process";
import { errorLogger, errorHandler } from "./middleware/errorMiddleware.js";
import axios from "axios";
import { Server } from "socket.io";
import http from "http";
import Message from "./models/Message.js";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (parent directory of backend)
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Swagger documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

// Routes
app.use("/api/v1/shop", shopRoutes);
app.use("/api/v1/characters", characterRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/parties", partyRoutes);
app.use("/api/v1/messages", messageRoutes);
app.use("/api/v1/npc", npcRoutes);
app.use("/api/v1/npc-memory", npcMemoryRoutes);
app.use("/api/v1/combat-log", combatLogRoutes);
app.use("/api/v1/rest", restRoutes);
app.use("/api/v1/loot", lootRoutes);
app.use("/api/v1/merchant", merchantRoutes);
app.use("/api/openai", openaiRoutes);
app.use("/api/npc", npcRoutes);
app.use("/quest", questRoutes);
app.use("/api/v1/skills", skillRoutes);
app.use("/api/armor", armorRoutes);
app.use("/api/v1/weapons", weaponRoutes);
console.log("✅ Weapon routes loaded at /api/v1/weapons");

// GM-RAG routes
app.post("/api/v1/gm", async (req, res) => {
  try {
    const { prompt } = req.body ?? {};

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const { context, citations } = await retrieveContext(prompt);

    const toolDesc = [
      "Tools available:",
      "- roll(expr): roll dice like 1d20+3, 3d6-1",
      "- mapStarts: list or random starting locations",
    ].join("\n");

    const messages = [
      { role: "system", content: systemGM },
      {
        role: "system",
        content: `CONTEXT (facts & rules):\n${context}\n\n${toolDesc}`,
      },
      { role: "user", content: prompt },
    ];

    const model = process.env.GM_MODEL ?? "gpt-4o-mini";

    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature: 0.6,
    });

    res.json({
      reply: completion.choices[0].message.content,
      citations,
      context: context.slice(0, 500) + "...", // For debugging
    });
  } catch (error) {
    console.error("GM endpoint error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GM admin routes
app.post("/api/v1/gm/reindex", async (req, res) => {
  try {
    const count = await buildVectors("backend/data");
    res.json({
      indexed: count,
      message: `Successfully indexed ${count} documents`,
    });
  } catch (error) {
    console.error("Reindex error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GM tools
app.post("/api/v1/gm/roll", (req, res) => {
  try {
    const { expr } = req.body ?? {};
    const result = roll(expr || "1d20");
    res.json(result);
  } catch (error) {
    console.error("Dice roll error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/v1/gm/map-starts", (_req, res) =>
  res.json({ starts: listStarts() })
);
app.get("/api/v1/gm/map-starts/random", (_req, res) =>
  res.json({ start: randomStart() })
);

// Debug route registration
console.log("Registered routes:");
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    console.log(
      `${Object.keys(middleware.route.methods)} ${middleware.route.path}`
    );
  } else if (middleware.name === "router") {
    middleware.handle.stack.forEach((handler) => {
      if (handler.route) {
        console.log(
          `${Object.keys(handler.route.methods)} ${handler.route.path}`
        );
      }
    });
  }
});

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    // Log available routes for debugging
    console.log("Available routes:");
    app._router.stack.forEach((r) => {
      if (r.route && r.route.path) {
        console.log(r.route.path);
      }
    });
  })
  .catch((err) => console.error("MongoDB connection error:", err));

// Game Session Schema
const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  campaignSettings: Object,
  playerState: Object,
  context: String,
  lastUpdate: { type: Date, default: Date.now },
});

const GameSession = mongoose.model("GameSession", sessionSchema);

// AI Service endpoints
const AI_SERVICE_URL = "http://localhost:8000";
const DEV_AI_SERVICE_URL = "http://localhost:8001";

// Create new game session
app.post("/api/session/create", async (req, res) => {
  try {
    const { campaignSettings } = req.body;
    const sessionId = Date.now().toString();

    // Create session in MongoDB
    const session = new GameSession({
      sessionId,
      campaignSettings,
      context: "",
      playerState: {},
    });
    await session.save();

    // Create session in AI service
    await axios.post(`${AI_SERVICE_URL}/session/create`, {
      session_id: sessionId,
      campaign_settings: campaignSettings,
    });

    res.json({
      success: true,
      sessionId,
      message: "Game session created successfully",
    });
  } catch (error) {
    console.error("Session Creation Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create game session",
    });
  }
});

// Generate AI response
app.post("/api/game/interact", async (req, res) => {
  try {
    const { sessionId, playerInput, playerState } = req.body;

    // Get session from MongoDB
    const session = await GameSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    // Call AI service
    const aiResponse = await axios.post(`${AI_SERVICE_URL}/generate`, {
      session_id: sessionId,
      player_input: playerInput,
      player_state: playerState,
    });

    // Update session in MongoDB
    session.playerState = playerState;
    session.lastUpdate = new Date();
    await session.save();

    res.json({
      success: true,
      response: aiResponse.data.response,
      sessionId,
    });
  } catch (error) {
    console.error("AI Interaction Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process game interaction",
    });
  }
});

// Development testing endpoint
app.post("/api/dev/test-generate", async (req, res) => {
  try {
    const { context, playerInput } = req.body;

    const response = await axios.post(`${DEV_AI_SERVICE_URL}/test/generate`, {
      context,
      player_input: playerInput,
      max_tokens: 100,
    });

    res.json({
      success: true,
      response: response.data.response,
    });
  } catch (error) {
    console.error("Dev Test Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate test response",
    });
  }
});

// Get session info
app.get("/api/session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await GameSession.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    res.json({
      success: true,
      session: session.toObject(),
    });
  } catch (error) {
    console.error("Session Fetch Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch session information",
    });
  }
});

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*", // Change to your frontend domain in production
    methods: ["GET", "POST"],
  },
});

// Helper function to broadcast system messages
export function broadcastSystemMessage(
  partyId,
  text,
  type = "system",
  user = "System"
) {
  const msg = {
    user,
    text,
    type,
    partyId,
    time: new Date(),
  };

  return Message.create(msg)
    .then((saved) => {
      io.to(partyId).emit("partyMessage", saved);
      console.log(`System message sent to party ${partyId}: ${text}`);
      return saved;
    })
    .catch((err) => {
      console.error("Failed to send system message:", err);
      throw err;
    });
}

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // When client joins a party room
  socket.on("joinParty", (partyId) => {
    socket.join(partyId);
    console.log(`Socket ${socket.id} joined party ${partyId}`);
  });

  // When client leaves a party room
  socket.on("leaveParty", (partyId) => {
    socket.leave(partyId);
    console.log(`Socket ${socket.id} left party ${partyId}`);
  });

  // 💬 Handle party chat messages
  socket.on("partyMessage", async ({ partyId, user, text }) => {
    const msg = {
      user,
      text,
      partyId,
      time: new Date(),
    };

    try {
      // Save to MongoDB
      const savedMessage = await Message.create(msg);
      console.log(`Party ${partyId} message saved: ${user}: ${text}`);

      // Broadcast only to users in this party
      io.to(partyId).emit("partyMessage", savedMessage);
    } catch (err) {
      console.error("Failed to save message:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Export io so routes can use it
export { io };

// Error handling middleware (must be before server starts)
app.use(errorLogger);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`WebSocket server running on port ${PORT}`);
  console.log(
    `API Documentation available at http://localhost:${PORT}/api-docs`
  );
});
