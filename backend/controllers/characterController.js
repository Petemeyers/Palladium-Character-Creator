import Character from "../models/Character.js";
import { assignInitialEquipment } from "../utils/characterUtils.js";

export const createCharacter = async (req, res) => {
  try {
    const characterData = req.body;

    // Validate required fields
    if (!characterData.name || !characterData.species || !characterData.class) {
      return res.status(400).json({
        message:
          "Missing required fields: name, species, and class are required",
      });
    }

    // Validate attributes
    if (
      !characterData.attributes ||
      typeof characterData.attributes !== "object"
    ) {
      return res.status(400).json({
        message: "Invalid attributes format",
      });
    }

    // Get initial equipment and gold based on class
    const { inventory, gold } = assignInitialEquipment(characterData.class);

    // Create character with initial equipment and gold
    const character = new Character({
      ...characterData,
      inventory: inventory || [],
      gold: gold || 100,
      user: req.user.id,
      level: characterData.level || 1,
      hp: characterData.hp || 10,
      alignment: characterData.alignment || "Neutral",
      gender: characterData.gender || "Unknown",
    });

    await character.save();

    res.status(201).json({
      message: "Character created successfully",
      character,
      initialEquipment: {
        items: inventory,
        gold,
      },
    });
  } catch (error) {
    console.error("Error creating character:", error);
    res.status(500).json({
      message: "Failed to create character",
      error: error.message,
      details: error.stack,
    });
  }
};

// ... rest of the controller functions
