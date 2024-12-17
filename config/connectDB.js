import mongoose from "mongoose";
import dotenv from "dotenv";
import process from "process";

dotenv.config();

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("Error: MONGODB_URI is not defined in the .env file");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected successfully 🎉");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error.message);
    console.error("Stack Trace:", error.stack);
    process.exit(1); // Exit process with failure
  }
};
