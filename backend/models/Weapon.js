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
});

export default mongoose.model("Weapon", weaponSchema);
