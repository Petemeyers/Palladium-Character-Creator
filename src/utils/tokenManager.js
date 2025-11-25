// Token management utilities
class TokenManager {
  // Check if token is expired without making a server call
  static isTokenExpired(token) {
    if (!token) return true;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const currentTime = Math.floor(Date.now() / 1000);

      // Check if token is expired, with a 5-minute buffer
      return payload.exp < currentTime + 300;
    } catch (error) {
      console.error("Error parsing token:", error);
      return true;
    }
  }

  // Get token expiration time
  static getTokenExpiration(token) {
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return new Date(payload.exp * 1000);
    } catch (error) {
      console.error("Error parsing token expiration:", error);
      return null;
    }
  }

  // Remove expired token from localStorage
  static clearExpiredToken() {
    const token = localStorage.getItem("token");
    if (token && this.isTokenExpired(token)) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      return true; // Token was cleared
    }
    return false; // Token was not cleared
  }

  // Get user info from token
  static getUserFromToken(token) {
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return {
        id: payload.id,
        username: payload.username,
      };
    } catch (error) {
      console.error("Error parsing user from token:", error);
      return null;
    }
  }

  // Check token validity and clean up if needed
  static validateAndCleanup() {
    const token = localStorage.getItem("token");
    if (!token) return false;

    if (this.isTokenExpired(token)) {
      this.clearExpiredToken();
      return false;
    }

    return true;
  }
}

// Utility function to format time until expiration
export const getTimeUntilExpiration = (token) => {
  const expTime = TokenManager.getTokenExpiration(token);
  if (!expTime) return "Unknown";

  const now = new Date();
  const diffMs = expTime.getTime() - now.getTime();

  if (diffMs <= 0) return "Expired";

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export default TokenManager;
