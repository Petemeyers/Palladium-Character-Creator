/**
 * Validation Middleware
 * Provides input validation and sanitization for API routes
 */

/**
 * Sanitize input to prevent XSS and injection attacks
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export function sanitizeInput(req, res, next) {
  // Sanitize string inputs
  const sanitizeString = (str) => {
    if (typeof str !== "string") return str;
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // Remove script tags
      .replace(/[<>]/g, "") // Remove angle brackets
      .trim();
  };

  // Recursively sanitize object
  const sanitizeObject = (obj) => {
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    if (obj !== null && typeof obj === "object") {
      const sanitized = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    }
    if (typeof obj === "string") {
      return sanitizeString(obj);
    }
    return obj;
  };

  // Sanitize body, query, and params
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
}

/**
 * Validation middleware wrapper
 * @param {Object|Function} schema - Validation schema or validation function
 * @param {string} source - Source of data to validate ('body', 'query', 'params')
 * @returns {Function} Express middleware function
 */
export function validate(schema, source = "body") {
  return (req, res, next) => {
    try {
      const data = req[source];
      
      // If schema is a function, call it
      if (typeof schema === "function") {
        const result = schema(data);
        if (result !== true && result !== undefined) {
          return res.status(400).json({ error: result });
        }
      }
      // If schema is an object with validate method
      else if (schema && typeof schema.validate === "function") {
        const { error } = schema.validate(data);
        if (error) {
          return res.status(400).json({ error: error.details[0].message });
        }
      }
      // Basic validation - check required fields if schema is an object
      else if (schema && typeof schema === "object") {
        const requiredFields = schema.required || [];
        for (const field of requiredFields) {
          if (!data || data[field] === undefined || data[field] === null) {
            return res.status(400).json({ error: `${field} is required` });
          }
        }
      }

      next();
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };
}

/**
 * Character validation schemas
 */
export const characterValidation = {
  create: (data) => {
    // Basic validation for character creation
    if (!data || typeof data !== "object") {
      return "Invalid character data";
    }
    
    if (!data.name || typeof data.name !== "string" || data.name.trim().length === 0) {
      return "Character name is required";
    }
    
    if (!data.species || typeof data.species !== "string") {
      return "Character species is required";
    }
    
    // Additional validations can be added here
    return true; // Validation passed
  },
  
  update: (data) => {
    // Basic validation for character update
    if (!data || typeof data !== "object") {
      return "Invalid character data";
    }
    
    // Update validation is more lenient - only validate if fields are present
    if (data.name !== undefined && (!data.name || typeof data.name !== "string" || data.name.trim().length === 0)) {
      return "Character name must be a non-empty string";
    }
    
    return true; // Validation passed
  },
};

export default {
  validate,
  characterValidation,
  sanitizeInput,
};

