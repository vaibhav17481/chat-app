import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt";
import {
  issueVerificationOtp,
  recordResendAttempt,
  getResendAttemptCooldownMs,
} from "../services/verification.service.js";
import {
  MAX_VERIFICATION_ATTEMPTS,
  RESEND_COOLDOWN_SECONDS,
  isValidOtpFormat,
  normalizeEmail,
  verifyOtp,
} from "../services/otp.service.js";
import {
  createRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
} from "../services/token.service.js";
import {
  clearRefreshCookie,
  getRefreshCookie,
  setRefreshCookie,
} from "../utils/cookies.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 30;

/**
 * Every "this code did not work" case answers with the same wording, so the
 * endpoint cannot be used to find out which addresses are registered.
 */
const INVALID_CODE_MESSAGE =
  "Invalid or expired verification code. Please request a new one.";

/**
 * The resend endpoint answers the same way for every address, whether it is
 * registered or not.
 */
const RESEND_MESSAGE =
  "If that address needs verification, a new code has been sent to it.";

/** Strips every sensitive field before a user object leaves the server. */
const sanitizeUser = (user) => {
  const {
    password: _password,
    verificationCodeHash: _verificationCodeHash,
    verificationCodeExpiry: _verificationCodeExpiry,
    verificationSentAt: _verificationSentAt,
    verificationAttempts: _verificationAttempts,
    ...safeUser
  } = user;

  return safeUser;
};

export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body ?? {};

    const cleanEmail = normalizeEmail(email);
    const cleanUsername = String(username ?? "").trim();

    if (!cleanUsername || !cleanEmail || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({
        message: "Please provide a valid email address",
      });
    }

    if (
      cleanUsername.length < MIN_USERNAME_LENGTH ||
      cleanUsername.length > MAX_USERNAME_LENGTH
    ) {
      return res.status(400).json({
        message: `Username must be between ${MIN_USERNAME_LENGTH} and ${MAX_USERNAME_LENGTH} characters`,
      });
    }

    if (String(password).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: cleanEmail }, { username: cleanUsername }],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username: cleanUsername,
        email: cleanEmail,
        password: hashedPassword,
        emailVerified: false,
      },
    });

    let outcome;

    try {
      outcome = await issueVerificationOtp(user);
    } catch (error) {
      console.error(
        "Failed to send the verification email during registration:",
        error?.message
      );

      return res.status(502).json({
        message:
          "Account created, but we could not send the verification email. Please request a new code to continue.",
      });
    }

    return res.status(201).json({
      message: "Registration successful. Please verify your email.",
      cooldownRemaining: Math.ceil(outcome.cooldownRemainingMs / 1000),
    });
  } catch (error) {
    // A concurrent registration can still win the unique constraint race.
    if (error?.code === "P2002") {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    console.error("Registration failed:", error?.message);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    // The password is checked before anything else so that only the owner of
    // an account can trigger a verification email for it.
    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    if (!user.emailVerified) {
      let outcome;

      try {
        outcome = await issueVerificationOtp(user);
      } catch (error) {
        console.error(
          "Failed to send the verification email during login:",
          error?.message
        );

        return res.status(502).json({
          message:
            "We could not send a verification code to your email. Please try again in a moment.",
        });
      }

      const cooldownRemaining = Math.ceil(outcome.cooldownRemainingMs / 1000);

      return res.status(403).json({
        message: outcome.sent
          ? "Please verify your email. We sent a 6-digit code to your email address."
          : "Please verify your email. A verification code was already sent to your email address.",
        requiresVerification: true,
        codeSent: outcome.sent,
        cooldownRemaining,
      });
    }

    const token = signAccessToken(user.id);
    const refreshToken = await createRefreshToken(user.id);

    setRefreshCookie(res, refreshToken);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Login failed:", error?.message);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

/**
 * Exchanges the refresh cookie for a new access token. The refresh token is
 * rotated, so a captured cookie can only be used once.
 */
export const refreshSession = async (req, res) => {
  try {
    const current = getRefreshCookie(req);

    const rotated = await rotateRefreshToken(current);

    if (!rotated) {
      clearRefreshCookie(res);

      return res.status(401).json({
        message: "Session expired. Please sign in again.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: rotated.userId },
    });

    if (!user) {
      clearRefreshCookie(res);

      return res.status(401).json({
        message: "Session expired. Please sign in again.",
      });
    }

    setRefreshCookie(res, rotated.token);

    return res.status(200).json({
      message: "Session refreshed",
      token: signAccessToken(user.id),
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Session refresh failed:", error?.message);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

/** Revokes the refresh token so the session cannot be continued. */
export const logout = async (req, res) => {
  try {
    const current = getRefreshCookie(req);

    await revokeRefreshToken(current);

    clearRefreshCookie(res);

    return res.status(200).json({
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout failed:", error?.message);

    clearRefreshCookie(res);

    return res.status(200).json({
      message: "Logged out successfully",
    });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body ?? {};

    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail || code === undefined || code === null || code === "") {
      return res.status(400).json({
        message: "Email and verification code are required",
      });
    }

    if (!isValidOtpFormat(code)) {
      // The shape of the input is the only hint here, it does not depend on
      // whether the address is known.
      return res.status(400).json({
        message: "The verification code must be 6 digits.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    // An unknown address, an already verified address and a wrong code all
    // look exactly the same from the outside.
    if (!user || user.emailVerified) {
      return res.status(400).json({
        message: INVALID_CODE_MESSAGE,
      });
    }

    if (!user.verificationCodeHash || !user.verificationCodeExpiry) {
      return res.status(400).json({
        message: INVALID_CODE_MESSAGE,
      });
    }

    if (new Date() > user.verificationCodeExpiry) {
      // Drop the stale code so it can never be used later on.
      await prisma.user.update({
        where: { id: user.id },
        data: {
          verificationCodeHash: null,
          verificationCodeExpiry: null,
          verificationAttempts: 0,
        },
      });

      return res.status(400).json({
        message: INVALID_CODE_MESSAGE,
      });
    }

    if (!verifyOtp(cleanEmail, code, user.verificationCodeHash)) {
      const attempts = (user.verificationAttempts ?? 0) + 1;
      const locked = attempts >= MAX_VERIFICATION_ATTEMPTS;

      await prisma.user.update({
        where: { id: user.id },
        data: locked
          ? {
              verificationAttempts: attempts,
              verificationCodeHash: null,
              verificationCodeExpiry: null,
            }
          : { verificationAttempts: attempts },
      });

      return res.status(400).json({
        message: INVALID_CODE_MESSAGE,
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationCodeHash: null,
        verificationCodeExpiry: null,
        verificationSentAt: null,
        verificationAttempts: 0,
      },
    });

    return res.status(200).json({
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Email verification failed:", error?.message);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body ?? {};

    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    // The cooldown only depends on how often this address asked for a code,
    // never on whether the address is registered. The check and the
    // bookkeeping happen without a break in between, so two parallel
    // requests cannot both slip through.
    const cooldownRemainingMs = getResendAttemptCooldownMs(cleanEmail);

    if (cooldownRemainingMs > 0) {
      const retryAfter = Math.ceil(cooldownRemainingMs / 1000);

      return res.status(429).json({
        message: `Please wait ${retryAfter} second(s) before requesting another verification code.`,
        retryAfter,
        cooldownRemaining: retryAfter,
      });
    }

    recordResendAttempt(cleanEmail);

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (user && !user.emailVerified) {
      try {
        await issueVerificationOtp(user);
      } catch (error) {
        console.error(
          "Failed to resend the verification email:",
          error?.message
        );

        return res.status(502).json({
          message: "Failed to send the verification email. Please try again.",
        });
      }
    }

    return res.status(200).json({
      message: RESEND_MESSAGE,
      cooldownRemaining: RESEND_COOLDOWN_SECONDS,
    });
  } catch (error) {
    console.error("Resend verification code failed:", error?.message);

    return res.status(500).json({
      message: "Failed to resend verification code",
    });
  }
};
