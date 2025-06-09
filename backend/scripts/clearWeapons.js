import mongoose from "mongoose";
import dotenv from "dotenv";
import process from "process";
import Weapon from "../models/Weapon.js";

dotenv.config();

const clearWeapons = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    await Weapon.deleteMany({});
    console.log("Cleared weapons");

    await mongoose.connection.close();
    console.log("Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("Error clearing weapons:", error);
    process.exit(1);
  }
};

clearWeapons();
