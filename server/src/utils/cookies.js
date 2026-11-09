import {
  REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_TTL_MS,
} from "../services/token.service.js";

const baseOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/auth",
});

/** Stores the refresh token in an httpOnly cookie that JavaScript cannot read. */
export const setRefreshCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...baseOptions(),
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
};

/** Removes the refresh cookie, e.g. on logout. */
export const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, baseOptions());
};

/** Reads the refresh token from the request cookies. */
export const getRefreshCookie = (req) => req.cookies?.[REFRESH_COOKIE_NAME];
