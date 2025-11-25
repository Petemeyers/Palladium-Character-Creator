import express from "express";
import process from "process";
import mongoose from "mongoose";
import Character from "../models/Character.js";
import User from "../models/User.js";
import Party from "../models/Party.js";
import auth from "../middleware/auth.js";
import {
  validate,
  characterValidation,
  sanitizeInput,
} from "../middleware/validation.js";
import { io } from "../server.js";

const router = express.Router();

// Add auth middleware to all routes
router.use(auth);
// Add input sanitization to all routes
router.use(sanitizeInput);

// GET all characters for the logged-in user
router.get("/", async (req, res) => {
  try {
    // Use userId if available, fallback to id
    const userId = req.user.userId || req.user.id;
    console.log("Fetching characters for user:", userId, "req.user:", req.user);

    let userCharacters = [];
    
    // First, try to get characters from User document's characters array
    try {
      // Convert userId to ObjectId if it's a string
      let userIdForQuery = userId;
      if (typeof userId === 'string' && mongoose.Types.ObjectId.isValid(userId)) {
        userIdForQuery = new mongoose.Types.ObjectId(userId);
      }
      
      const userDoc = await User.findById(userIdForQuery).select('characters');
      if (userDoc && userDoc.characters && userDoc.characters.length > 0) {
        console.log("User has", userDoc.characters.length, "characters in array");
        // Fetch characters by their IDs from the user's characters array
        userCharacters = await Character.find({
          _id: { $in: userDoc.characters },
        });
        console.log("Found", userCharacters.length, "characters from user's array");
      } else {
        console.log("User document not found or has no characters in array");
      }
    } catch (userDocError) {
      console.error("Error fetching user document:", userDocError.message);
      console.error("Error stack:", userDocError.stack);
      console.error("UserId used:", userId, "Type:", typeof userId);
    }
    
    // Also query by user field (in case characters weren't added to user's array)
    try {
      const userFieldCharacters = await Character.find({
        $or: [
          { user: userId },
          { isBulkCharacter: true }
        ],
      });
      
      console.log("Found", userFieldCharacters.length, "characters by user field");
      
      // Combine and deduplicate
      const allCharacters = [...userCharacters, ...userFieldCharacters];
      const uniqueCharacters = Array.from(
        new Map(allCharacters.map(char => [char._id.toString(), char])).values()
      );
      
      userCharacters = uniqueCharacters;
    } catch (queryError) {
      console.error("Error querying characters by user field:", queryError.message, queryError.stack);
      // If we have characters from user doc, use those; otherwise throw
      if (userCharacters.length === 0) {
        throw queryError;
      }
    }

    console.log("Found characters:", userCharacters.length);
    if (userCharacters.length > 0) {
      console.log("Sample character user field:", {
        firstCharUserId: userCharacters[0].user,
        firstCharUserIdType: typeof userCharacters[0].user,
        firstCharUserIdString: userCharacters[0].user?.toString(),
        matchesUserId: userCharacters[0].user?.toString() === userId.toString(),
      });
    }

    // Filter out characters that are in someone else's party
    const availableCharacters = userCharacters.filter(
      (char) => {
        try {
          if (!char.inParty) {
            return true; // Not in a party, so available
          }
          
          // If in a party, check if user owns it
          if (!char.partyOwner) {
            return true; // No party owner, so available
          }
          
          // Compare party owner with user ID (handle both ObjectId and string)
          const partyOwnerStr = char.partyOwner.toString();
          const userIdStr = userId.toString();
          
          return partyOwnerStr === userIdStr;
        } catch (filterError) {
          console.error("Error filtering character:", filterError.message, {
            charId: char._id,
            charName: char.name,
            inParty: char.inParty,
            partyOwner: char.partyOwner,
          });
          // If filtering fails, include the character to be safe
          return true;
        }
      }
    );

    console.log("Available characters after filtering:", availableCharacters.length);

    res.status(200).json(availableCharacters);
  } catch (error) {
    console.error("Error fetching characters:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", {
      message: error.message,
      name: error.name,
      userId: req.user?.userId,
      userIdType: typeof req.user?.userId,
    });
    res.status(500).json({
      success: false,
      message: "Server Error: Unable to retrieve characters.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// POST add new character and link to user
router.post("/", validate(characterValidation.create), async (req, res) => {
  try {
    console.log("=== Character Creation Route ===");
    console.log("Received req.body:", {
      name: req.body.name,
      occSkills: req.body.occSkills,
      electiveSkills: req.body.electiveSkills,
      secondarySkills: req.body.secondarySkills,
    });

    // Convert user ID to ObjectId for proper MongoDB storage
    const userId = mongoose.Types.ObjectId.isValid(req.user.userId) 
      ? new mongoose.Types.ObjectId(req.user.userId)
      : req.user.userId;

    console.log("Creating character for user:", {
      userId: req.user.userId,
      convertedUserId: userId,
    });

    // Create new character with user reference
    const newCharacter = new Character({
      ...req.body,
      user: userId,
    });

    console.log("Character before save:", {
      name: newCharacter.name,
      occSkills: newCharacter.occSkills,
      electiveSkills: newCharacter.electiveSkills,
      secondarySkills: newCharacter.secondarySkills,
    });

    // Save the character
    const savedCharacter = await newCharacter.save();

    console.log("Character after save:", {
      name: savedCharacter.name,
      occSkills: savedCharacter.occSkills,
      electiveSkills: savedCharacter.electiveSkills,
      secondarySkills: savedCharacter.secondarySkills,
    });

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
router.post(
  "/bulk",
  validate(characterValidation.create, "body"),
  async (req, res) => {
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
  }
);

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

    // Use findByIdAndUpdate with runValidators to handle version conflicts automatically
    const updateData = {};

    // Handle inventory updates
    if (updates.inventory) {
      updateData.inventory = updates.inventory.map((item) => ({
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

    // Handle equipped items updates
    if (updates.equipped) {
      updateData.equipped = updates.equipped;
    }

    // Handle wardrobe updates
    if (updates.wardrobe) {
      updateData.wardrobe = updates.wardrobe;
    }

    // Handle other updates
    Object.keys(updates).forEach((key) => {
      if (key !== "inventory" && key !== "equipped" && key !== "wardrobe") {
        updateData[key] = updates[key];
      }
    });

    const savedCharacter = await Character.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!savedCharacter) {
      return res.status(404).json({
        success: false,
        message: "Character not found",
      });
    }

    // Find parties this character belongs to and emit updates
    try {
      const parties = await Party.find({ members: id }).populate("members");
      parties.forEach((party) => {
        io.to(party._id.toString()).emit("partyUpdated", party);
      });
    } catch (wsError) {
      console.error("Error emitting party updates:", wsError);
    }

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

    // Find parties this character belongs to and emit updates
    try {
      const parties = await Party.find({ members: req.params.id }).populate(
        "members"
      );
      parties.forEach((party) => {
        io.to(party._id.toString()).emit("partyUpdated", party);
      });
    } catch (wsError) {
      console.error("Error emitting party updates:", wsError);
    }

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
