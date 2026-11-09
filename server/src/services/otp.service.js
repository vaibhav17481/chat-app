import crypto from "node:crypto";

/** Number of digits in a verification code. */
export const OTP_LENGTH = 6;

/** How long a verification code stays valid. */
export const OTP_TTL_MS = 10 * 60 * 1000;

/** Minimum delay between two verification emails. */
export const RESEND_COOLDOWN_SECONDS = 30;

/** How many wrong codes are tolerated before the pending code is dropped. */
export const MAX_VERIFICATION_ATTEMPTS = 5;

const OTP_MIN = 10 ** (OTP_LENGTH - 1);
const OTP_MAX = 10 ** OTP_LENGTH;

const getSecret = () =>
  process.env.JWT_SECRET || "chat-app-otp-fallback-development-secret";

/**
 * Generates a cryptographically random numeric one-time code.
 * `crypto.randomInt` is used instead of `Math.random` because the code
 * is the only factor standing between an account and an attacker.
 */
export const generateOtp = () =>
  crypto.randomInt(OTP_MIN, OTP_MAX).toString().padStart(OTP_LENGTH, "0");

/**
 * Hashes a code together with the account email. A keyed hash (HMAC) is used
 * so the stored value cannot be brute-forced offline without the server secret.
 */
export const hashOtp = (email, code) =>
  crypto
    .createHmac("sha256", getSecret())
    .update(`${normalizeEmail(email)}:${code}`)
    .digest("hex");

/**
 * Constant time comparison of a submitted code against the stored hash.
 */
export const verifyOtp = (email, code, storedHash) => {
  if (!storedHash || code === undefined || code === null) {
    return false;
  }

  const expected = Buffer.from(String(storedHash), "utf8");
  const actual = Buffer.from(hashOtp(email, code), "utf8");

  if (expected.length !== actual.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, actual);
};

/** True when the value looks like a 6 digit numeric code. */
export const isValidOtpFormat = (code) =>
  new RegExp(`^\\d{${OTP_LENGTH}}$`).test(String(code ?? ""));

/** Emails are matched case-insensitively everywhere. */
export const normalizeEmail = (email) => String(email ?? "").trim().toLowerCase();
