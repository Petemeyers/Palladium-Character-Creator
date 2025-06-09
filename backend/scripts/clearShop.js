import mongoose from "mongoose";
import dotenv from "dotenv";
import process from "process";
import ShopItem from "../models/ShopItem.js";

dotenv.config();

const clearShop = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    await ShopItem.deleteMany({});
    console.log("Cleared shop items");

    await mongoose.connection.close();
    console.log("Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("Error clearing shop:", error);
    process.exit(1);
  }
};

clearShop();
