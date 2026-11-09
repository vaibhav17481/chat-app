import rateLimit from "express-rate-limit";

const defaultMessage = "Too many requests. Please try again later.";

/**
 * Creates a rate limiter.
 *
 * `skipInTest` keeps the automated suite from tripping the limiters while
 * still exercising the middleware itself.
 */
export const createRateLimiter = ({
  windowMs = 15 * 60 * 1000,
  max = 30,
  message = defaultMessage,
  skipInTest = true,
} = {}) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: skipInTest && process.env.NODE_ENV === "test" ? () => true : undefined,
    message: { message },
  });

/** Brute force protection for the login endpoint. */
export const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts. Please try again later.",
});

/** Stops a single address from creating a flood of accounts. */
export const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many accounts were created from this address. Please try again later.",
});

/** Stops code guessing. */
export const verifyLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many verification attempts. Please request a new code.",
});

/** Stops verification code spam. */
export const resendLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many code requests. Please try again later.",
});

/** Keeps session refreshes from being abused. */
export const refreshLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: "Too many session refreshes. Please sign in again.",
});

/** General protection for the whole API. */
export const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: "Too many requests. Please slow down.",
});
