import express from "express";
import Character from "../models/Character.js";

const router = express.Router();

// GET all characters
router.get("/", async (req, res) => {
  try {
    const characters = await Character.find();
    res.status(200).json(characters);
  } catch (error) {
    console.error("Error fetching characters:", error);
    res
      .status(500)
      .json({ message: "Server Error: Unable to retrieve characters." });
  }
});

// GET character by ID
router.get("/:id", async (req, res) => {
  try {
    const character = await Character.findById(req.params.id);
    if (!character) {
      return res.status(404).json({ message: "Character not found." });
    }
    res.status(200).json(character);
  } catch (error) {
    console.error("Error fetching character:", error);
    res
      .status(500)
      .json({ message: "Server Error: Unable to retrieve character." });
  }
});

// POST add new character
router.post("/", async (req, res) => {
  try {
    const newCharacter = new Character(req.body);
    await newCharacter.save();
    res.status(201).json(newCharacter);
  } catch (error) {
    console.error("Error adding character:", error);
    res.status(500).json({
      message: "Server Error: Unable to add character.",
      error: error.message,
    });
  }
});

// PUT update character by ID (combined route for all updates)
router.put("/:id", async (req, res) => {
  try {
    const updates = req.body;
    const updatedCharacter = await Character.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!updatedCharacter) {
      return res.status(404).json({ message: "Character not found." });
    }

    res.status(200).json(updatedCharacter);
  } catch (error) {
    console.error("Error updating character:", error);
    res
      .status(500)
      .json({ message: "Server Error: Unable to update character." });
  }
});

// DELETE character by ID
router.delete("/:id", async (req, res) => {
  try {
    const deletedCharacter = await Character.findByIdAndDelete(req.params.id);

    if (!deletedCharacter) {
      return res.status(404).json({ message: "Character not found." });
    }

    res.status(200).json({ message: "Character deleted successfully." });
  } catch (error) {
    console.error("Error deleting character:", error);
    res
      .status(500)
      .json({ message: "Server Error: Unable to delete character." });
  }
});

// Add this new route for bulk character creation
router.post("/bulk", async (req, res) => {
  try {
    const characters = req.body;

    // Validate that we received an array
    if (!Array.isArray(characters)) {
      return res.status(400).json({
        message: "Invalid request: Expected an array of characters",
      });
    }

    // Use insertMany for better performance with bulk insertion
    const savedCharacters = await Character.insertMany(characters, {
      ordered: false, // Continues inserting even if some documents fail
    });

    res.status(201).json({
      message: `Successfully created ${savedCharacters.length} characters`,
      characters: savedCharacters,
    });
  } catch (error) {
    console.error("Error adding characters in bulk:", error);
    res.status(500).json({
      message: "Server Error: Unable to add characters in bulk.",
      error: error.message,
    });
  }
});

export default router;
