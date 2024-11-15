import mongoose from "mongoose";

const characterSchema = new mongoose.Schema({
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
});

const Character = mongoose.model("Character", characterSchema);
export default Character;
