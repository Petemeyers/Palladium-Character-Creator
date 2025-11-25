import Character from "../models/Character.js";
import { assignInitialEquipment } from "../utils/characterUtils.js";

export const createCharacter = async (req, res) => {
  try {
    const characterData = req.body;

    // Debug logging
    console.log("Received character data:", {
      name: characterData.name,
      inventory: characterData.inventory,
      inventoryLength: characterData.inventory?.length,
      firstItem: characterData.inventory?.[0],
    });

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

    // Use the inventory sent from frontend (already processed correctly)
    // Don't call assignInitialEquipment again as it's already handled in frontend

    // Create character with initial equipment and gold
    const character = new Character({
      ...characterData,
      inventory: characterData.inventory || [],
      gold: characterData.gold || 100,
      user: req.user.id,
      level: characterData.level || 1,
      hp: characterData.hp || 10,
      alignment: characterData.alignment || "Neutral",
      gender: characterData.gender || "Unknown",
      occSkills: characterData.occSkills || [],
      electiveSkills: characterData.electiveSkills || [],
      secondarySkills: characterData.secondarySkills || [],
    });

    console.log("Character object before save:", {
      name: character.name,
      occSkills: character.occSkills,
      electiveSkills: character.electiveSkills,
      secondarySkills: character.secondarySkills,
    });

    await character.save();

    console.log("Character saved successfully with skills:", {
      occSkills: character.occSkills,
      electiveSkills: character.electiveSkills,
      secondarySkills: character.secondarySkills,
    });

    res.status(201).json({
      message: "Character created successfully",
      character,
      initialEquipment: {
        items: character.inventory || [],
        gold: character.gold || 100,
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
