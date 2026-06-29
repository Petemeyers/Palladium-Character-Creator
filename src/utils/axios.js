import axios from "axios";
import {
  createAPIError,
  logError,
  APIError,
  NetworkError,
} from "./errorHandler.js";
import { markBackendOffline } from "./backendStatus.js";
import { clearStoredAuthState, getStoredAuthToken, storeAuthSession } from "./authStorage.js";

const instance = axios.create({
  baseURL: "http://localhost:5000/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30 second timeout
});

// Enhanced request interceptor
instance.interceptors.request.use(
  (config) => {
    const token = getStoredAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (
      (import.meta.env?.DEV || import.meta.env?.MODE === "development") &&
      String(config.url || "").includes("/characters")
    ) {
      console.debug("[character-save] axios request", {
        method: config.method?.toUpperCase(),
        url: `${config.baseURL || ""}${config.url || ""}`,
        hasAuthorization: Boolean(config.headers.Authorization),
        payloadKeys: config.data && typeof config.data === "object" && !Array.isArray(config.data)
          ? Object.keys(config.data).sort()
          : [],
      });
    }

    // Log request for debugging (only in development)
    if (import.meta.env?.DEV || import.meta.env?.MODE === "development") {
      console.log(
        `API Request: ${config.method?.toUpperCase()} ${config.url}`,
        {
          data: config.data,
          params: config.params,
        },
      );
    }

    return config;
  },
  (error) => {
    logError(error, { type: "request_interceptor" });
    return Promise.reject(error);
  },
);

// Enhanced response interceptor with comprehensive error handling
instance.interceptors.response.use(
  (response) => {
    // Log successful responses (only in development)
    if (import.meta.env?.DEV || import.meta.env?.MODE === "development") {
      console.log(`API Response: ${response.status} ${response.config.url}`);

      // âœ… ADD: log the response body (pretty-printed)
      try {
        console.log(
          "API Response Data:",
          JSON.stringify(response.data, null, 2),
        );
      } catch {
        // Fallback if something can't be stringified
        console.log("API Response Data (raw):", response.data);
      }
    }
    return response;
  },
  async (error) => {
    const apiError = createAPIError(error);

    if (
      (import.meta.env?.DEV || import.meta.env?.MODE === "development") &&
      String(error.config?.url || "").includes("/characters")
    ) {
      console.debug("[character-save] axios response error", {
        status: error.response?.status ?? null,
        message: error.response?.data?.message || error.response?.data?.error || error.message,
        response: error.response?.data || null,
        hasAuthorization: Boolean(error.config?.headers?.Authorization),
      });
    }

    // Skip logging 404s for expected endpoints:
    // - /parties/active: expected when no active party exists
    // - /messages/:partyId: expected when party has no messages yet
    // Also check for suppressErrorLogging flag in request config
    const shouldSkipLogging =
      error.config?.suppressErrorLogging === true ||
      apiError instanceof NetworkError ||
      (apiError instanceof APIError &&
        apiError.status === 404 &&
        (error.config?.url?.includes("/parties/active") ||
          error.config?.url?.includes("/messages/")));

    // Log all errors except skistaminad ones
    if (!shouldSkipLogging) {
      logError(apiError, {
        type: "response_interceptor",
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
      });
    }

    // Handle specific error cases
    if (apiError instanceof APIError) {
      switch (apiError.status) {
        case 401: {
          // Handle token expiration by attempting refresh
          const originalRequest = error.config;

          if (originalRequest?.suppressAuthPrompt === true) {
            clearStoredAuthState();
            break;
          }

          // Don't retry if this is already a refresh attempt or login
          if (
            originalRequest?.url?.includes("/refresh-token") ||
            originalRequest?.url?.includes("/login")
          ) {
            clearStoredAuthState();
            if (window.location.pathname !== "/login") {
              const message =
                apiError.response?.data?.code === "TOKEN_EXPIRED"
                  ? "Your session has expired. Please log in again."
                  : "Authentication required. Please log in.";

              if (window.confirm(message + " Click OK to go to login page.")) {
                window.location.href = "/login";
              }
            }
            break;
          }

          // Attempt to refresh token
          const token = getStoredAuthToken();
          if (token && apiError.response?.data?.code === "TOKEN_EXPIRED") {
            try {
              const refreshResponse = await axios.post(
                "/users/refresh-token",
                {},
                { headers: { Authorization: `Bearer ${token}` } },
              );

              if (refreshResponse.data.token) {
                storeAuthSession(refreshResponse.data.token, refreshResponse.data.user);

                // Retry original request with new token
                originalRequest.headers.Authorization = `Bearer ${refreshResponse.data.token}`;
                return axios(originalRequest);
              }
            } catch (refreshError) {
              console.error("Token refresh failed:", refreshError);
              // Clear tokens and redirect to login
              clearStoredAuthState();
              if (window.location.pathname !== "/login") {
                if (
                  window.confirm(
                    "Session expired. Please log in again. Click OK to go to login page.",
                  )
                ) {
                  window.location.href = "/login";
                }
              }
            }
          } else {
            // Clear tokens for non-expiration 401s
            clearStoredAuthState();
            if (window.location.pathname !== "/login") {
              const message = "Authentication required. Please log in.";
              if (window.confirm(message + " Click OK to go to login page.")) {
                window.location.href = "/login";
              }
            }
          }
          break;
        }

        case 403:
          console.warn("Access denied:", apiError.message);
          break;

        case 404:
          // Don't warn for expected 404s:
          // - /parties/active: expected when no active party exists
          // - /messages/:partyId: expected when party has no messages yet
          if (
            !error.config?.url?.includes("/parties/active") &&
            !error.config?.url?.includes("/messages/")
          ) {
            console.warn("Resource not found:", apiError.message);
          }
          break;

        case 429:
          alert("Too many requests. Please wait a moment and try again.");
          break;

        case 500:
          console.error("Server error:", apiError.message);
          break;

        default:
          console.error("API Error:", apiError.message);
      }
    } else if (apiError instanceof NetworkError) {
      markBackendOffline();
    }

    return Promise.reject(apiError);
  },
);

// Enhanced API methods with better error handling
export const api = {
  get: async (url, config = {}) => {
    try {
      return await instance.get(url, config);
    } catch (error) {
      throw createAPIError(error);
    }
  },

  post: async (url, data, config = {}) => {
    try {
      return await instance.post(url, data, config);
    } catch (error) {
      throw createAPIError(error);
    }
  },

  put: async (url, data, config = {}) => {
    try {
      return await instance.put(url, data, config);
    } catch (error) {
      throw createAPIError(error);
    }
  },

  delete: async (url, config = {}) => {
    try {
      return await instance.delete(url, config);
    } catch (error) {
      throw createAPIError(error);
    }
  },

  patch: async (url, data, config = {}) => {
    try {
      return await instance.patch(url, data, config);
    } catch (error) {
      throw createAPIError(error);
    }
  },
};

export default instance;
