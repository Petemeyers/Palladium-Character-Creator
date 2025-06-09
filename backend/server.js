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
import process from "process";
import { errorLogger, errorHandler } from "./middleware/errorMiddleware.js";
import axios from "axios";

dotenv.config();

const app = express();

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(
    `API Documentation available at http://localhost:${PORT}/api-docs`
  );
});

// Error handling middleware
app.use(errorLogger);
app.use(errorHandler);
