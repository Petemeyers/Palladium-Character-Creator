import mongoose from "mongoose";

const HexSchema = new mongoose.Schema(
  {
    q: { type: Number, required: true }, // axial q
    r: { type: Number, required: true }, // axial r
    terrain: { type: String, default: "OPEN_GROUND" }, // or "grass", "forest", etc.
    elev: { type: Number, default: 0 },
  },
  { _id: false },
);

const EntitySchema = new mongoose.Schema(
  {
    id: { type: String, required: true }, // characterId, enemyId, objectId
    kind: { type: String, required: true }, // "CHARACTER" | "ENEMY" | "OBJECT"
    q: { type: Number, required: true },
    r: { type: Number, required: true },
    facing: { type: Number, default: 0 }, // 0..5 for hex facings
    meta: { type: Object, default: {} }, // optional extras
  },
  { _id: false },
);

const MapSchema = new mongoose.Schema(
  {
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Party",
      index: true,
      required: true,
    },
    isActive: { type: Boolean, default: true, index: true },

    kind: { type: String, default: "HEX" }, // "HEX" now; could support "SQUARE" later
    width: { type: Number, default: 40 },
    height: { type: Number, default: 30 },

    terrainPreset: { type: String, default: "OPEN_GROUND" },
    seed: { type: Number, default: 0 },
    version: { type: Number, default: 1 },

    // Choose ONE representation. We'll store hexes for flexibility.
    hexes: { type: [HexSchema], default: [] },

    // Optional: server-authoritative placements (you can also derive from party members later)
    entities: { type: [EntitySchema], default: [] },
  },
  { timestamps: true },
);

export default mongoose.model("Map", MapSchema);
