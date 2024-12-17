import express from "express";
import process from "process";
import Character from "../models/Character.js";
import User from "../models/User.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// Add auth middleware to all routes
router.use(auth);

// GET all characters for the logged-in user
router.get("/", async (req, res) => {
  try {
    const userCharacters = await Character.find({
      $or: [{ user: req.user.userId }, { isBulkCharacter: true }],
    });

    // Filter out characters that are in someone else's party
    const availableCharacters = userCharacters.filter(
      (char) =>
        !char.inParty ||
        (char.partyOwner && char.partyOwner.equals(req.user.userId))
    );

    res.status(200).json(availableCharacters);
  } catch (error) {
    console.error("Error fetching characters:", error);
    res.status(500).json({
      success: false,
      message: "Server Error: Unable to retrieve characters.",
    });
  }
});

// POST add new character and link to user
router.post("/", async (req, res) => {
  try {
    // Create new character with user reference
    const newCharacter = new Character({
      ...req.body,
      user: req.user.userId,
    });

    // Save the character
    const savedCharacter = await newCharacter.save();

    // Add character to user's characters array
    await User.findByIdAndUpdate(
      req.user.userId,
      { $push: { characters: savedCharacter._id } },
      { new: true }
    );

    res.status(201).json(savedCharacter);
  } catch (error) {
    console.error("Error adding character:", error);
    res.status(500).json({
      success: false,
      message: "Server Error: Unable to add character.",
      error: error.message,
    });
  }
});

// DELETE single character
router.delete("/:id", async (req, res) => {
  try {
    const character = await Character.findOneAndDelete({
      _id: req.params.id,
      $or: [{ user: req.user.userId }, { isBulkCharacter: true }],
    });

    if (!character) {
      return res.status(404).json({
        success: false,
        message:
          "Character not found or you don't have permission to delete it",
      });
    }

    // Remove character from user's characters array if it exists
    if (req.user.userId) {
      await User.findByIdAndUpdate(req.user.userId, {
        $pull: { characters: req.params.id },
      });
    }

    res.status(200).json({
      success: true,
      message: "Character deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting character:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting character",
      error: error.message,
    });
  }
});

// DELETE all characters for a user
router.delete("/all", async (req, res) => {
  try {
    // First check if there are any characters to delete
    const characters = await Character.find({
      $or: [{ user: req.user.userId }, { isBulkCharacter: true }],
    });

    if (characters.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No characters found to delete.",
        count: 0,
      });
    }

    // Delete all matching characters
    const deleteResult = await Character.deleteMany({
      $or: [{ user: req.user.userId }, { isBulkCharacter: true }],
    }).exec();

    // Update user's characters array if user exists
    if (req.user.userId) {
      try {
        await User.findByIdAndUpdate(req.user.userId, {
          $set: { characters: [] },
        }).exec();
      } catch (userError) {
        console.error("Error updating user's characters array:", userError);
        // Continue even if user update fails
      }
    }

    console.log("Delete result:", deleteResult);

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${deleteResult.deletedCount} characters.`,
      count: deleteResult.deletedCount,
    });
  } catch (error) {
    console.error("Error in delete all route:", error);
    res.status(500).json({
      success: false,
      message: "Server Error: Unable to delete characters.",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// Bulk delete characters
router.post("/bulk-delete", async (req, res) => {
  try {
    const { characterIds } = req.body;

    if (!Array.isArray(characterIds)) {
      return res.status(400).json({
        success: false,
        message: "characterIds must be an array",
      });
    }

    const result = await Character.deleteMany({
      _id: { $in: characterIds },
      $or: [{ user: req.user.userId }, { isBulkCharacter: true }],
    });

    // Remove characters from user's characters array
    if (req.user.userId) {
      await User.findByIdAndUpdate(req.user.userId, {
        $pull: { characters: { $in: characterIds } },
      });
    }

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} characters`,
    });
  } catch (error) {
    console.error("Error bulk deleting characters:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting characters",
      error: error.message,
    });
  }
});

// Bulk character creation with user reference
router.post("/bulk", async (req, res) => {
  try {
    const characters = req.body;

    // Validate that characters is an array
    if (!Array.isArray(characters)) {
      return res.status(400).json({
        success: false,
        message: "Request body must be an array of characters",
      });
    }

    // Add user reference and bulk flag to each character
    const charactersWithUser = characters.map((character) => ({
      ...character,
      user: req.user.userId,
      isBulkCharacter: true,
    }));

    // Create the characters
    const createdCharacters = await Character.insertMany(charactersWithUser);

    // Update user's characters array
    await User.findByIdAndUpdate(req.user.userId, {
      $push: {
        characters: {
          $each: createdCharacters.map((char) => char._id),
        },
      },
    });

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdCharacters.length} characters`,
      characters: createdCharacters,
    });
  } catch (error) {
    console.error("Error creating bulk characters:", error);
    res.status(500).json({
      success: false,
      message: "Error creating characters",
      error: error.message,
    });
  }
});

// Add a route to get bulk characters
router.get("/bulk", async (req, res) => {
  try {
    const bulkCharacters = await Character.find({ isBulkCharacter: true });
    res.status(200).json(bulkCharacters);
  } catch (error) {
    console.error("Error fetching bulk characters:", error);
    res.status(500).json({
      success: false,
      message: "Server Error: Unable to retrieve bulk characters.",
    });
  }
});

// PUT update character
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const character = await Character.findById(id);
    if (!character) {
      return res.status(404).json({
        success: false,
        message: "Character not found",
      });
    }

    // Handle inventory updates
    if (updates.inventory) {
      character.inventory = updates.inventory.map((item) => ({
        name: item.name || "",
        category: item.category || "",
        price: Number(item.price) || 0,
        description: item.description || "",
        damage: item.damage || "",
        weight: item.weight || "",
        length: item.length || "",
        handed: item.handed || "",
        type: item.type || "Item",
      }));
    }

    // Handle other updates
    Object.keys(updates).forEach((key) => {
      if (key !== "inventory") {
        character[key] = updates[key];
      }
    });

    const savedCharacter = await character.save();

    res.status(200).json({
      success: true,
      message: "Character updated successfully",
      character: savedCharacter,
    });
  } catch (error) {
    console.error("Error updating character:", error);
    res.status(500).json({
      success: false,
      message: "Error updating character",
      error: error.message,
    });
  }
});

// Add route to add/remove character from party
router.put("/:id/party-status", async (req, res) => {
  try {
    const { inParty } = req.body;
    const character = await Character.findById(req.params.id);

    if (!character) {
      return res.status(404).json({
        success: false,
        message: "Character not found",
      });
    }

    // Check if character is available
    if (
      inParty &&
      character.inParty &&
      character.partyOwner &&
      !character.partyOwner.equals(req.user.userId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Character is already in another user's party",
      });
    }

    // Update party status
    character.inParty = inParty;
    character.partyOwner = inParty ? req.user.userId : null;
    await character.save();

    res.status(200).json({
      success: true,
      message: inParty
        ? "Character added to party"
        : "Character removed from party",
      character,
    });
  } catch (error) {
    console.error("Error updating party status:", error);
    res.status(500).json({
      success: false,
      message: "Server Error: Unable to update party status",
    });
  }
});

export default router;
