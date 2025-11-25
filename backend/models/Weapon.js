import mongoose from "mongoose";

const weaponSchema = new mongoose.Schema({
  itemId: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  damage: String,
  weight: String,
  length: String,
  handed: String,
  description: String,
  // Enhanced weapon stats
  reach: Number, // Reach in feet for melee weapons
  range: Number, // Range in feet for ranged weapons
  rateOfFire: Number, // Attacks per melee for ranged weapons
  ammunition: String, // Type of ammunition required
  strengthRequired: Number, // Minimum P.S. required
  notes: String, // Special properties and usage notes
});

export default mongoose.model("Weapon", weaponSchema);
