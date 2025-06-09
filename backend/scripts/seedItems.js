import mongoose from "mongoose";
import dotenv from "dotenv";
import ShopItem from "../models/ShopItem.js";
import { seedItems } from "../items.js";
import process from "process";

dotenv.config();

mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("Connected to MongoDB");
    await seedItems(ShopItem);
    console.log("Seeding complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });
