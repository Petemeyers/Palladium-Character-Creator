import process from "process";

export const errorLogger = (err, req, res, next) => {
  console.error("Error:", err);
  next(err);
};

export const errorHandler = (err, req, res, next) => {
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err : {},
  });
};
