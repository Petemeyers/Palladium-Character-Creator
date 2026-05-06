import Party from "../models/Party.js";
import { ensureActiveMapForParty } from "../services/ensureActiveMap.js";

export async function getActiveSession(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const party = await Party.findOne({ owner: userId })
      .sort({ updatedAt: -1 })
      .populate({
        path: "members",
        select: "name level class species attributes imageUrl",
      });

    if (!party) return res.status(404).json({ message: "No party found" });

    const map = await ensureActiveMapForParty(party._id, {
      width: 40,
      height: 30,
      terrainPreset: "OPEN_GROUND",
    });

    return res.json({
      party,
      map,
      characters: party.members || [],
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error("getActiveSession error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
