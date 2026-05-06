import Map from "../models/Map.js";
import { generateDefaultHexMap } from "./mapGenerator.js";

export async function ensureActiveMapForParty(partyId, opts = {}) {
  if (!partyId) return null;

  let mapDoc = await Map.findOne({ partyId, isActive: true }).lean();
  if (mapDoc) return mapDoc;

  const seed = opts.seed ?? Math.floor(Math.random() * 1_000_000_000);
  const width = opts.width ?? 40;
  const height = opts.height ?? 30;
  const terrainPreset = opts.terrainPreset ?? "OPEN_GROUND";

  const mapData = generateDefaultHexMap({ width, height, terrainPreset, seed });

  const created = await Map.create({
    partyId,
    isActive: true,
    ...mapData,
  });

  return created.toObject();
}
