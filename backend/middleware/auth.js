/* eslint-env node */
import jwt from "jsonwebtoken";
import process from "process";

const auth = (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ message: "No authentication token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Ensure both id and userId are set for compatibility
    req.user = {
      id: decoded.id,
      userId: decoded.id, // Set userId to match id for compatibility
      username: decoded.username,
      ...decoded, // Include any other fields from the token
    };
    next();
  } catch {
    res.status(401).json({ message: "Authentication failed" });
  }
};

// Export both as default and named export for compatibility
export default auth;
export const authenticateToken = auth;
