import mongoose from "mongoose";

const characterSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  isBulkCharacter: {
    type: Boolean,
    default: false,
  },
  inParty: {
    type: Boolean,
    default: false,
  },
  partyOwner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  name: {
    type: String,
    required: true,
  },
  species: {
    type: String,
    required: true,
  },
  class: {
    type: String,
    required: true,
  },
  attributes: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    required: true,
  },
  level: {
    type: Number,
    required: true,
  },
  hp: {
    type: Number,
    required: true,
    default: 10,
  },
  alignment: {
    type: String,
    required: true,
  },
  origin: {
    type: String,
    required: true,
  },
  socialBackground: {
    type: String,
    required: true,
  },
  age: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  disposition: {
    type: String,
    required: true,
  },
  hostility: {
    type: String,
    required: true,
  },
  imageUrl: {
    type: String,
    default: "",
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  gender: {
    type: String,
    required: true,
  },
  inventory: [
    {
      name: { type: String, required: true },
      category: { type: String, required: true },
      price: { type: Number, default: 0 },
      description: { type: String, default: "" },
      damage: { type: String, default: "" },
      weight: { type: String, default: "" },
      length: { type: String, default: "" },
      handed: { type: String, default: "" },
      type: { type: String, default: "Item" },
    },
  ],
  gold: {
    type: Number,
    default: 0,
  },
  carryWeight: {
    maxWeight: Number,
    currentWeight: { type: Number, default: 0 },
    lightDuration: Number,
    heavyDuration: Number,
  },
});

characterSchema.methods.isAvailable = function () {
  return (
    !this.inParty || (this.partyOwner && this.partyOwner.equals(this.user))
  );
};

characterSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  if (this.inParty && !this.partyOwner) {
    this.inParty = false;
  }
  if (this.attributes.PS) {
    this.carryWeight = {
      maxWeight: this.attributes.PS * 10,
      currentWeight: this.carryWeight?.currentWeight || 0,
      lightDuration: this.attributes.PE * 2,
      heavyDuration: this.attributes.PE,
    };
  }
  next();
});

const Character = mongoose.model("Character", characterSchema);
export default Character;
