import axios from "axios";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import process from "process";

dotenv.config();

// Create rate limiter
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Adjust based on your OpenAI plan
  message: "Too many chat requests, please try again in a minute",
});

export const handleChat = async (req, res) => {
  try {
    const { message, character } = req.body;

    const systemPrompt = `You are a Game Master for a Palladium RPG game. 
    You are interacting with ${character.name}, a level ${character.level} ${
      character.species
    } ${character.class} 
    with ${
      character.alignment
    } alignment. Their attributes are ${JSON.stringify(character.attributes)}.
    Respond in character as a Game Master, keeping responses concise (2-3 sentences) and engaging.
    Consider the character's background, abilities, and attributes in your responses.`;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 100,
        temperature: 0.7,
        presence_penalty: 0.6,
        frequency_penalty: 0.3,
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
      character: character.name,
    });
  } catch (error) {
    console.error("Chat error:", error.response?.data || error.message);

    if (error.response?.status === 429) {
      res.status(429).json({
        message: "Rate limit exceeded. Please try again in a minute.",
      });
    } else if (error.response?.status === 401) {
      res.status(500).json({
        message: "OpenAI API key error. Please check your configuration.",
      });
    } else {
      res.status(500).json({
        message: "Failed to process chat request",
        error: error.message,
      });
    }
  }
};
