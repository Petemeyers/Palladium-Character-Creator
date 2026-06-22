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
  profession: {
    type: String,
    required: true,
  },
  ruleset: {
    type: String,
    required: false,
  },
  sizePolicy: {
    type: String,
    required: false,
  },
  legacyCompatibility: {
    type: Boolean,
    required: false,
  },
  publicClassId: {
    type: String,
    required: false,
  },
  publicClassName: {
    type: String,
    required: false,
  },
  publicBackgroundId: {
    type: String,
    required: false,
  },
  publicBackgroundName: {
    type: String,
    required: false,
  },
  publicSkillProficiencies: [String],
  publicSkillChoices: [String],
  publicSpeciesId: {
    type: String,
    required: false,
  },
  publicSpeciesName: {
    type: String,
    required: false,
  },
  creatureType: {
    type: String,
    required: false,
  },
  publicLanguages: [String],
  size: {
    type: String,
    required: false,
  },
  speed: {
    type: Number,
    required: false,
  },
  abilityScoreMethod: {
    type: String,
    required: false,
  },
  baseAbilityScores: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    required: false,
  },
  backgroundAbilityBonuses: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    required: false,
  },
  finalAbilityScores: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    required: false,
  },
  abilityModifiers: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    required: false,
  },
  publicStartingEquipment: {
    type: mongoose.Schema.Types.Mixed,
    required: false,
  },
  selectedClassEquipmentOptionId: {
    type: String,
    required: false,
  },
  backgroundEquipmentTags: [String],
  startingGold: {
    type: Number,
    required: false,
  },
  publicDerivedStats: {
    type: mongoose.Schema.Types.Mixed,
    required: false,
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
    required: false,
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
  equistaminadWeapon: {
    type: String,
    default: "",
  },
  equistaminadArmor: {
    type: String,
    default: "",
  },
  equistaminadWeapons: [
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
  equistaminad: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
  equipment: {
    type: mongoose.Schema.Types.Mixed,
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
  astaminaarance: {
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
        enum: ["skill", "combat", "training", "tactical"],
        required: true,
      },
      bonus: { type: String, default: "" },
      bonusType: { type: String, default: "" }, // "attack", "damage", etc.
      value: { type: Number, default: 0 },
      weapon: { type: String, default: "" }, // for weapon-specific bonuses
      condition: { type: String, default: "" }, // for conditional bonuses
      damage: { type: String, default: "" }, // for technique damage
      effect: { type: String, default: "" }, // for technique effects
      uses: { type: Number, default: null }, // limited-use powers
      usesRemaining: { type: Number, default: null }, // tracked per character
    },
  ],
  professionSkills: [String],
  electiveSkills: [String],
  secondarySkills: [String],
  training: [
    {
      name: { type: String, required: true }, // e.g. "Fireball"
      cost: { type: Number, required: true }, // stamina (Potential Psychic Energy)
      damage: { type: String, default: "" }, // e.g. "4d6"
      effect: { type: String, default: "" }, // e.g. "Gain +5 Armor for 1 hour"
      usesRemaining: { type: Number, default: null }, // for daily limits
    },
  ],
  tactics: [
    {
      name: { type: String, required: true }, // e.g. "Telekinesis"
      cost: { type: Number, required: true }, // focus (Inner Strength Points)
      effect: { type: String, default: "" }, // e.g. "Move object 60 lbs"
      damage: { type: String, default: "" }, // optional (e.g. Mind Bolt = "2d6")
      usesRemaining: { type: Number, default: null }, // for daily limits
    },
  ],
  tacticalOptions: [
    {
      name: { type: String, required: true },
      category: {
        type: String,
        enum: ["Physical", "Sensitive", "Healing", "Super"],
        required: true,
      },
      focus: { type: Number, required: true },
      duration: { type: String, required: true },
      range: { type: String, required: true },
      damage: { type: String, default: null },
      effect: { type: String, required: true },
      attackType: { type: String, required: true },
      saveType: { type: String, default: null },
      description: { type: String, required: true },
    },
  ],
  stamina: { type: Number, default: 20 }, // Potential Psychic Energy
  focus: { type: Number, default: 10 }, // Inner Strength Points
  saves: {
    vsTraining: { type: Number, default: 12 }, // target number on d20
    vsTactics: { type: Number, default: 15 }, // usually harder
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
