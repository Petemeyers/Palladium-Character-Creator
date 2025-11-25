import Party from "../models/Party.js";
import Character from "../models/Character.js";
import { io } from "../server.js";

export const createParty = async (req, res) => {
  try {
    const { name, members, startLocation } = req.body;

    console.log("Creating party with user:", req.user);
    console.log("Members:", members);
    console.log("Start Location:", startLocation);

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Party name is required",
      });
    }

    if (!members || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one party member is required",
      });
    }

    if (
      !startLocation ||
      !startLocation.id ||
      !startLocation.label ||
      !startLocation.region
    ) {
      return res.status(400).json({
        success: false,
        message: "Starting location is required",
      });
    }

    // Find all requested characters
    const charactersExist = await Character.find({
      _id: { $in: members },
    }).lean();

    console.log("Found characters:", charactersExist);

    // Check each character's accessibility
    const accessibleCharacters = charactersExist.filter((char) => {
      // Convert ObjectId to string for comparison
      const charUserId = char.user ? char.user.toString() : null;
      const requestUserId = req.user.userId.toString();

      return (
        char.isBulkCharacter || // Bulk characters are always accessible
        !char.user || // Characters without user are accessible
        charUserId === requestUserId // User owns the character
      );
    });

    if (accessibleCharacters.length !== members.length) {
      const foundIds = accessibleCharacters.map((c) => c._id.toString());
      const inaccessibleIds = members.filter(
        (id) => !foundIds.includes(id.toString())
      );

      return res.status(400).json({
        success: false,
        message: "One or more characters not found or not accessible",
        debug: {
          found: accessibleCharacters.length,
          expected: members.length,
          foundIds,
          requestedIds: members,
          inaccessibleIds,
          userId: req.user.userId,
          userIdAlt: req.user.id,
          characters: charactersExist.map((c) => ({
            id: c._id,
            user: c.user,
            isBulk: c.isBulkCharacter,
          })),
        },
      });
    }

    // Create party with validated data
    const party = new Party({
      name: name.trim(),
      members,
      startLocation,
      owner: req.user.userId,
    });

    await party.save();

    // Update characters' party status
    await Character.updateMany(
      { _id: { $in: members } },
      {
        inParty: true,
        partyOwner: req.user.userId,
      }
    );

    const populatedParty = await Party.findById(party._id).populate({
      path: "members",
      select: "name level class species attributes imageUrl",
    });

    // Emit party update via WebSocket
    try {
      io.to(populatedParty._id.toString()).emit("partyUpdated", populatedParty);
    } catch (wsError) {
      console.error("Error emitting party update:", wsError);
    }

    res.status(201).json({
      success: true,
      party: populatedParty,
    });
  } catch (error) {
    console.error("Error creating party:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create party",
      error: error.message,
    });
  }
};

export const getParties = async (req, res) => {
  try {
    const parties = await Party.find({ owner: req.user.userId }).populate({
      path: "members",
      select: "name level class species attributes imageUrl",
    });

    res.status(200).json(parties);
  } catch (error) {
    console.error("Error fetching parties:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch parties",
      error: error.message,
    });
  }
};

export const getActiveParty = async (req, res) => {
  try {
    // Get the most recently updated party for the user
    // This serves as a simple "active party" - can be enhanced later with explicit active flag
    const activeParty = await Party.findOne({ owner: req.user.userId })
      .sort({ updatedAt: -1 }) // Most recently updated
      .populate({
        path: "members",
        select: "name level class species attributes imageUrl",
      });

    // Return 200 with null instead of 404 to avoid browser console errors
    // Frontend will handle null as "no active party"
    res.status(200).json(activeParty || null);
  } catch (error) {
    console.error("Error fetching active party:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch active party",
      error: error.message,
    });
  }
};

export const updateParty = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, members, startLocation } = req.body;

    // Validate members exist
    const charactersExist = await Character.find({
      _id: { $in: members },
      $or: [{ user: req.user.userId }, { isBulkCharacter: true }],
    });

    if (charactersExist.length !== members.length) {
      return res.status(400).json({
        success: false,
        message: "One or more characters not found or not accessible",
      });
    }

    const party = await Party.findOne({ _id: id, owner: req.user.userId });
    if (!party) {
      return res.status(404).json({
        success: false,
        message: "Party not found",
      });
    }

    // Remove party status from old members
    await Character.updateMany(
      { _id: { $in: party.members } },
      {
        inParty: false,
        partyOwner: null,
      }
    );

    // Update party
    party.name = name;
    party.members = members;
    if (startLocation) {
      party.startLocation = startLocation;
    }
    await party.save();

    // Update new members' party status
    await Character.updateMany(
      { _id: { $in: members } },
      {
        inParty: true,
        partyOwner: req.user.userId,
      }
    );

    const updatedParty = await Party.findById(id).populate({
      path: "members",
      select: "name level class species attributes imageUrl",
    });

    // Emit party update via WebSocket
    try {
      io.to(updatedParty._id.toString()).emit("partyUpdated", updatedParty);
    } catch (wsError) {
      console.error("Error emitting party update:", wsError);
    }

    res.status(200).json({
      success: true,
      party: updatedParty,
    });
  } catch (error) {
    console.error("Error updating party:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update party",
      error: error.message,
    });
  }
};

export const deleteParty = async (req, res) => {
  try {
    const { id } = req.params;

    const party = await Party.findOne({ _id: id, owner: req.user.id });
    if (!party) {
      return res.status(404).json({
        success: false,
        message: "Party not found",
      });
    }

    // Remove party status from members
    await Character.updateMany(
      { _id: { $in: party.members } },
      {
        inParty: false,
        partyOwner: null,
      }
    );

    await party.deleteOne();

    // Emit party deletion via WebSocket
    try {
      io.to(id.toString()).emit("partyDeleted", { id: id });
    } catch (wsError) {
      console.error("Error emitting party deletion:", wsError);
    }

    res.status(200).json({
      success: true,
      message: "Party deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting party:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete party",
      error: error.message,
    });
  }
};
