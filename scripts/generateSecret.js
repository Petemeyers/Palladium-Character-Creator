import crypto from "crypto";

const generateSecret = () => {
  return crypto.randomBytes(64).toString("hex");
};

console.log("Generated JWT Secret:");
console.log(generateSecret());
