import mongoose from "mongoose";
import dotenv from "dotenv";
import process from "process";
import Weapon from "../models/Weapon.js";

dotenv.config();

const checkWeapons = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const weapons = await Weapon.find({});
    console.log(`Found ${weapons.length} weapons:`);
    console.log(weapons);

    await mongoose.connection.close();
  } catch (error) {
    console.error("Error checking weapons:", error);
  }
  process.exit(0);
};

checkWeapons();
