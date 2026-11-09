import axios from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  // The refresh token lives in an httpOnly cookie, so it has to be sent with
  // every request that should be able to renew the session.
  withCredentials: true,
});

/**
 * The access token is kept in memory only. It is short lived and disappears
 * when the tab is closed, so it cannot be picked up from localStorage by a
 * script that was injected into the page.
 */
let accessToken = null;

/** Called whenever the token changes, e.g. to update the socket handshake. */
let tokenChangeHandler = null;

export const setTokenChangeHandler = (handler) => {
  tokenChangeHandler = handler;
};

export const setAccessToken = (token) => {
  accessToken = token || null;

  tokenChangeHandler?.(accessToken);
};

export const getAccessToken = () => accessToken;

/** Called when the session cannot be renewed any more. */
let sessionExpiredHandler = null;

export const setSessionExpiredHandler = (handler) => {
  sessionExpiredHandler = handler;
};

// A plain instance without the interceptors, used for the refresh call itself.
const plainApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

// Only one refresh request may run at a time, otherwise a burst of expired
// requests would rotate the refresh token several times in a row.
let refreshInFlight = null;

const refreshAccessToken = () => {
  if (!refreshInFlight) {
    refreshInFlight = plainApi
      .post("/auth/refresh")
      .then((response) => {
        setAccessToken(response.data.token);

        return response.data.token;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const isAuthRoute = originalRequest?.url?.includes("/auth/");

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest.retried &&
      !isAuthRoute
    ) {
      originalRequest.retried = true;

      try {
        await refreshAccessToken();

        return api(originalRequest);
      } catch {
        setAccessToken(null);
        sessionExpiredHandler?.();
      }
    }

    return Promise.reject(error);
  }
);

export default api;
