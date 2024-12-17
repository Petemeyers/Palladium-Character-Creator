import axios from "axios";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

dotenv.config();

// Create rate limiter
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: "Too many chat requests, please try again in a minute",
});

export const handleChat = async (req, res) => {
  try {
    const { message, character } = req.body;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a Game Master for a Palladium RPG game. The player character is ${character.name}, 
            a level ${character.level} ${character.class} with ${character.alignment} alignment and 
            ${character.background} background. Keep responses concise and in character.`,
          },
          {
            role: "user",
            content: message,
          },
        ],
        max_tokens: 150, // Limit response length
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({
      message: response.data.choices[0].message.content,
    });
  } catch (error) {
    console.error("Chat error:", error.response?.data || error.message);

    // Handle different error types
    if (error.response?.status === 429) {
      res.status(429).json({
        message: "Chat service is busy. Please try again in a minute.",
      });
    } else if (error.response?.status === 401) {
      res.status(500).json({
        message: "Chat service configuration error. Please contact support.",
      });
    } else {
      res.status(500).json({
        message: "Failed to process chat",
        error: error.message,
      });
    }
  }
};
