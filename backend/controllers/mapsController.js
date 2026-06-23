import Party from "../models/Party.js";
import Map from "../models/Map.js";
import { safeEmit } from "../socket.js";
import { applyMapPatch } from "../services/applyMapPatch.js";
import { ensureActiveMapForParty } from "../services/ensureActiveMap.js";

export async function getActiveMap(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // Match your existing repo pattern
    const party = await Party.findOne({ owner: userId }).sort({
      updatedAt: -1,
    }).lean();
    if (!party) return res.status(404).json({ message: "No party found" });

    const mapDoc = await ensureActiveMapForParty(party._id, {
      width: 40,
      height: 30,
      terrainPreset: "OPEN_GROUND",
    });

    return res.json(mapDoc);
  } catch (err) {
    console.error("getActiveMap error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function commitActiveMap(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const party = await Party.findOne({ owner: userId }).sort({
      updatedAt: -1,
    }).lean();
    if (!party) return res.status(404).json({ message: "No party found" });

    await ensureActiveMapForParty(party._id, {
      width: 40,
      height: 30,
      terrainPreset: "OPEN_GROUND",
    });

    const mapDoc = await Map.findOne({ partyId: party._id, isActive: true });
    if (!mapDoc) return res.status(404).json({ message: "No active map found" });

    const patch = req.body?.patch ?? req.body;
    const baseVersion = req.body?.baseVersion;

    if (!patch) {
      return res.status(400).json({ message: "Missing patch payload" });
    }

    if (
      typeof baseVersion === "number" &&
      Number.isFinite(baseVersion) &&
      mapDoc.version !== baseVersion
    ) {
      return res.status(409).json({
        message: "Version conflict",
        currentVersion: mapDoc.version,
      });
    }

    const appliedOperations = applyMapPatch(mapDoc, patch);
    mapDoc.version += 1;
    await mapDoc.save();

    const payload = {
      mapId: mapDoc._id,
      patch: appliedOperations,
      version: mapDoc.version,
    };

    safeEmit("MAP_PATCH", payload);

    return res.json({
      success: true,
      ...payload,
    });
  } catch (err) {
    console.error("commitActiveMap error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
