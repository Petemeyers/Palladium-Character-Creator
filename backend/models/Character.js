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
  occ: {
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
      weight: { type: Number, default: 0 },
      length: { type: String, default: "" },
      handed: { type: String, default: "" },
      type: {
        type: String,
        enum: ["Weapon", "Item", "weapon", "armor", "consumable", "item"],
        default: "Item",
      },
      defense: { type: Number, default: 0 }, // only for armor
      effect: { type: String, default: "" }, // only for consumables
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
  equippedWeapon: {
    type: String,
    default: "",
  },
  equippedArmor: {
    type: String,
    default: "",
  },
  equippedWeapons: [
    {
      name: { type: String, default: "Unarmed" },
      damage: { type: String, default: "1d3" },
      range: { type: String, default: "" },
      reach: { type: String, default: "" },
      category: { type: String, default: "unarmed" },
      type: { type: String, default: "unarmed" },
      slot: { type: String, default: "" },
    },
  ],
  equipped: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
  wardrobe: [
    {
      name: { type: String, required: true },
      slot: { type: String, required: true },
      weight: { type: Number, default: 0 },
      defense: { type: Number, default: 0 },
      price: { type: Number, default: 0 },
      category: { type: String, default: "Clothing" },
    },
  ],
  appearance: {
    height: { type: String, default: "" },
    weight: { type: String, default: "" },
    hairColor: { type: String, default: "" },
    eyeColor: { type: String, default: "" },
    skinTone: { type: String, default: "" },
  },
  abilities: [
    {
      name: { type: String, required: true },
      type: {
        type: String,
        enum: ["skill", "combat", "magic", "psionic"],
        required: true,
      },
      bonus: { type: String, default: "" },
      bonusType: { type: String, default: "" }, // "attack", "damage", etc.
      value: { type: Number, default: 0 },
      weapon: { type: String, default: "" }, // for weapon-specific bonuses
      condition: { type: String, default: "" }, // for conditional bonuses
      damage: { type: String, default: "" }, // for spell damage
      effect: { type: String, default: "" }, // for spell effects
      uses: { type: Number, default: null }, // limited-use powers
      usesRemaining: { type: Number, default: null }, // tracked per character
    },
  ],
  occSkills: [String],
  electiveSkills: [String],
  secondarySkills: [String],
  magic: [
    {
      name: { type: String, required: true }, // e.g. "Fireball"
      cost: { type: Number, required: true }, // PPE (Potential Psychic Energy)
      damage: { type: String, default: "" }, // e.g. "4d6"
      effect: { type: String, default: "" }, // e.g. "Gain +5 Armor for 1 hour"
      usesRemaining: { type: Number, default: null }, // for daily limits
    },
  ],
  psionics: [
    {
      name: { type: String, required: true }, // e.g. "Telekinesis"
      cost: { type: Number, required: true }, // ISP (Inner Strength Points)
      effect: { type: String, default: "" }, // e.g. "Move object 60 lbs"
      damage: { type: String, default: "" }, // optional (e.g. Mind Bolt = "2d6")
      usesRemaining: { type: Number, default: null }, // for daily limits
    },
  ],
  psionicPowers: [
    {
      name: { type: String, required: true },
      category: {
        type: String,
        enum: ["Physical", "Sensitive", "Healing", "Super"],
        required: true,
      },
      isp: { type: Number, required: true },
      duration: { type: String, required: true },
      range: { type: String, required: true },
      damage: { type: String, default: null },
      effect: { type: String, required: true },
      attackType: { type: String, required: true },
      saveType: { type: String, default: null },
      description: { type: String, required: true },
    },
  ],
  PPE: { type: Number, default: 20 }, // Potential Psychic Energy
  ISP: { type: Number, default: 10 }, // Inner Strength Points
  saves: {
    vsMagic: { type: Number, default: 12 }, // target number on d20
    vsPsionics: { type: Number, default: 15 }, // usually harder
    vsPoison: { type: Number, default: 14 },
  },
  skillsAssigned: { type: Boolean, default: false }, // Track if skills have been assigned
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
