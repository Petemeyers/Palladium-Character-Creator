import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Party",
      default: null,
    },
    type: {
      type: String,
      enum: ["chat", "system", "combat", "npc"],
      default: "chat",
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
messageSchema.index({ partyId: 1, createdAt: -1 });
messageSchema.index({ user: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;

