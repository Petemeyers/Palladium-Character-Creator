import mongoose from "mongoose";

const PartySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: [1, "Party name must be at least 1 character"],
  },
  members: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Character",
    },
  ],
  startLocation: {
    id: { type: String, required: true },
    label: { type: String, required: true },
    region: { type: String, required: true },
    description: { type: String, default: "" },
    suggestedSkills: [{ type: String }],
    npcTypes: [{ type: String }],
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  currentTime: {
    type: Date,
    default: Date.now,
  },
  defaultRolloffMethod: {
    type: String,
    default: "d20", // can be "d20", "2d6", or "attribute:PE", etc.
  },
  gold: {
    type: Number,
    default: 0,
  },
  quests: [
    {
      title: String,
      description: String,
      status: { type: String, default: "active" }, // active | completed | failed
      rewards: [
        {
          type: { type: String, enum: ["gold", "item"], required: true },
          amount: Number, // for gold
          name: String, // for item
          quantity: Number,
        },
      ],
    },
  ],
  inventory: [
    {
      name: { type: String, required: true },
      type: {
        type: String,
        enum: ["weapon", "armor", "consumable", "misc"],
        required: true,
      },
      damage: { type: String, default: "" }, // weapons
      defense: { type: Number, default: 0 }, // armor
      effect: { type: String, default: "" }, // consumables
      weight: { type: Number, default: 0 },
      quantity: { type: Number, default: 1 },
      claimedBy: [{ type: String }], // charIds who requested it
    },
  ],
});

// Update the updatedAt field before saving
PartySchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model("Party", PartySchema);
