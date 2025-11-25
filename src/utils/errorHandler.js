// Enhanced error handling utilities for API calls

export class APIError extends Error {
  constructor(message, status, code, details = null) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.response = { data: details, status: status }; // Add response property for compatibility
    this.timestamp = new Date().toISOString();
  }
}

export class NetworkError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = "NetworkError";
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
}

export class ValidationError extends Error {
  constructor(message, field, value) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
    this.value = value;
    this.timestamp = new Date().toISOString();
  }
}

// Enhanced axios instance with robust error handling
export const createAPIError = (error) => {
  if (error.response) {
    // Server responded with error status
    const { status, data } = error.response;
    const message = data?.message || data?.error || `Server error (${status})`;
    const code = data?.code || "SERVER_ERROR";

    return new APIError(message, status, code, data);
  } else if (error.request) {
    // Request was made but no response received
    return new NetworkError("Network error - no response from server", error);
  } else {
    // Something else happened
    return new Error(`Request error: ${error.message}`);
  }
};

// Retry mechanism for failed requests
export const retryRequest = async (requestFn, maxRetries = 3, delay = 1000) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;

      // Don't retry on certain errors
      if (
        error instanceof APIError &&
        [400, 401, 403, 404].includes(error.status)
      ) {
        throw error;
      }

      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff
      const waitTime = delay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  throw lastError;
};

// Enhanced API call wrapper
export const apiCall = async (requestFn, options = {}) => {
  const { retries = 1, showError = true, logError = true } = options;

  try {
    const response = await retryRequest(requestFn, retries);
    return response;
  } catch (error) {
    const apiError = createAPIError(error);

    if (logError) {
      console.error("API Error:", {
        message: apiError.message,
        status: apiError.status,
        code: apiError.code,
        timestamp: apiError.timestamp,
        details: apiError.details,
      });
    }

    if (showError) {
      // Show user-friendly error message
      if (apiError instanceof NetworkError) {
        alert(
          "Network error: Please check your internet connection and try again."
        );
      } else if (apiError instanceof APIError) {
        if (apiError.status === 401) {
          alert("Session expired. Please log in again.");
          // Redirect to login
          localStorage.removeItem("token");
          window.location.href = "/login";
        } else if (apiError.status === 403) {
          alert(
            "Access denied. You do not have permission to perform this action."
          );
        } else if (apiError.status === 404) {
          alert(
            "Resource not found. The requested item may have been deleted."
          );
        } else if (apiError.status >= 500) {
          alert("Server error. Please try again later or contact support.");
        } else {
          alert(`Error: ${apiError.message}`);
        }
      } else {
        alert(`Unexpected error: ${apiError.message}`);
      }
    }

    throw apiError;
  }
};

// Specific error handlers for different scenarios
export const handleCharacterError = (error, operation) => {
  if (error instanceof APIError) {
    switch (error.status) {
      case 400:
        return `Invalid character data: ${error.message}`;
      case 404:
        return "Character not found. It may have been deleted.";
      case 409:
        return "Character name already exists. Please choose a different name.";
      default:
        return `Failed to ${operation} character: ${error.message}`;
    }
  }
  return `Failed to ${operation} character: ${error.message}`;
};

export const handlePartyError = (error, operation) => {
  if (error instanceof APIError) {
    switch (error.status) {
      case 400:
        return `Invalid party data: ${error.message}`;
      case 404:
        return "Party not found. It may have been deleted.";
      case 409:
        return "Party name already exists. Please choose a different name.";
      default:
        return `Failed to ${operation} party: ${error.message}`;
    }
  }
  return `Failed to ${operation} party: ${error.message}`;
};

export const handleAuthError = (error) => {
  if (error instanceof APIError) {
    switch (error.status) {
      case 400:
        return "Invalid username or password format.";
      case 401:
        return "Invalid credentials. Please check your username and password.";
      case 409:
        return "Username already exists. Please choose a different username.";
      default:
        return `Authentication error: ${error.message}`;
    }
  }
  return `Authentication error: ${error.message}`;
};

// Error logging utility
export const logError = (error, context = {}) => {
  const errorInfo = {
    timestamp: new Date().toISOString(),
    message: error.message,
    name: error.name,
    stack: error.stack,
    context,
  };

  // In production, this would send to a logging service
  console.error("Error Log:", errorInfo);

  // Store in localStorage for debugging (remove in production)
  try {
    const errorLog = JSON.parse(localStorage.getItem("errorLog") || "[]");
    errorLog.push(errorInfo);
    // Keep only last 50 errors
    if (errorLog.length > 50) {
      errorLog.splice(0, errorLog.length - 50);
    }
    localStorage.setItem("errorLog", JSON.stringify(errorLog));
  } catch (e) {
    console.warn("Could not save error to localStorage:", e);
  }
};
