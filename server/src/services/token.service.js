import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

/** Short lived token used for every API and socket call. */
export const ACCESS_TOKEN_TTL = "15m";

/** How long a refresh token stays usable. */
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Name of the cookie that carries the refresh token. */
export const REFRESH_COOKIE_NAME = "refresh_token";

/** Signs a short lived access token for the given user. */
export const signAccessToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });

/** Only the hash of a refresh token is ever stored. */
export const hashToken = (token) =>
  crypto.createHash("sha256").update(String(token)).digest("hex");

/**
 * Issues a new refresh token for a user and returns the raw token.
 * The raw token only ever travels inside the httpOnly cookie.
 */
export const createRefreshToken = async (userId) => {
  const token = crypto.randomBytes(48).toString("base64url");

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  return token;
};

/**
 * Exchanges a refresh token for a new one. The presented token is revoked,
 * so a stolen token can only be used once before it becomes useless.
 *
 * Returns `{ userId, token }` or null when the token is unknown, expired or
 * already revoked.
 */
export const rotateRefreshToken = async (token) => {
  if (!token) {
    return null;
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
    return null;
  }

  // The token is claimed first, so two concurrent refreshes can never both
  // win: only the request that manages to revoke it gets a new token.
  const claimed = await prisma.refreshToken.updateMany({
    where: { id: stored.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (claimed.count === 0) {
    return null;
  }

  const nextToken = crypto.randomBytes(48).toString("base64url");

  await prisma.refreshToken.create({
    data: {
      userId: stored.userId,
      tokenHash: hashToken(nextToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  return { userId: stored.userId, token: nextToken };
};

/** Revokes a single refresh token, used on logout. */
export const revokeRefreshToken = async (token) => {
  if (!token) {
    return false;
  }

  const result = await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return result.count > 0;
};

/** Revokes every refresh token of a user. */
export const revokeAllRefreshTokens = async (userId) => {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

/**
 * Removes tokens that are expired or revoked long ago. Called periodically so
 * the table does not grow forever.
 */
export const pruneRefreshTokens = async () => {
  const cutoff = new Date(Date.now() - REFRESH_TOKEN_TTL_MS);

  await prisma.refreshToken.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: cutoff } }],
    },
  });
};
