import jwt from "jsonwebtoken";
import process from "process";

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      userId: decoded.id,
      username: decoded.username,
    };
    console.log("Authenticated user:", req.user);
    next();
  } catch (error) {
    console.error("Auth error:", error);

    // Provide specific error messages for different JWT errors
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token expired",
        code: "TOKEN_EXPIRED",
        expiredAt: error.expiredAt,
      });
    } else if (error.name === "JsonWebTokenError") {
      return res.status(403).json({
        message: "Invalid token",
        code: "INVALID_TOKEN",
      });
    } else {
      return res.status(403).json({
        message: "Authentication failed",
        code: "AUTH_FAILED",
      });
    }
  }
};
