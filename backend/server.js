/* eslint-env node */
import cors from "cors";
import dotenv from "dotenv";
//import { fileURLToPath } from "url";
//import path from "path";
import express from "express";
import { connectDB } from "./config/connectDB.js";
import characterRoutes from "./routes/characterRoutes.js";
import OpenAI from "openai";
import process from "process";

// Load environment variables early
dotenv.config();
// ES Module fix for __dirname
//const __filename = fileURLToPath(import.meta.url);
//const __dirname = path.dirname(__filename);

console.log("MONGODB_URI:", process.env.MONGODB_URI);
console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY);

// Validate required environment variables
if (!process.env.MONGODB_URI || !process.env.OPENAI_API_KEY) {
  console.error(
    "Missing required environment variables: MONGODB_URI or OPENAI_API_KEY"
  );
  process.exit(1); // Exit the process if necessary environment variables are missing
}

const app = express();

// CORS configuration
app.use(
  cors({
    origin: "http://localhost:5173", // Your frontend URL (adjust as needed)
    credentials: true,
  })
);

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Routes
app.use("/api/characters", characterRoutes);

// Basic route
app.get("/", (req, res) => {
  res.send("API is running...");
});

// OpenAI configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Chat endpoint
app.post("/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ message: "Message content is missing" });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: message }],
      max_tokens: 150,
      temperature: 0.7,
    });

    const aiResponse = response.choices[0].message.content.trim();
    res.json({ message: aiResponse });
  } catch (error) {
    console.error("Error generating response from OpenAI:", error);
    res.status(500).json({
      message: "An error occurred while communicating with OpenAI.",
    });
  }
});

// Error handling middleware
/* eslint-disable-next-line no-unused-vars */
app.use((err, req, res, _next) => {
  // kept underscore but disabled ESLint warning
  console.error(err.stack);
  res.status(500).json({
    message: "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

const PORT = process.env.PORT || 5000;

// Start server function
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log("MongoDB Connected Successfully");

    // Start the server
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Server URL: http://localhost:${PORT}`);
    });

    // Graceful shutdown
    const shutdown = () => {
      console.log("Shutting down gracefully...");
      server.close(() => {
        console.log("Server closed");
        process.exit(0);
      });
    };

    // Handle shutdown signals
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);

    return server;
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server
startServer().catch(console.error);

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (error) => {
  console.error("Unhandled Rejection:", error);
});
