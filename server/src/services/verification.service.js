import crypto from "node:crypto";
import prisma from "../lib/prisma.js";
import { sendVerificationEmail } from "./email.service.js";
import {
  OTP_TTL_MS,
  RESEND_COOLDOWN_SECONDS,
  generateOtp,
  hashOtp,
  normalizeEmail,
} from "./otp.service.js";

/**
 * Remembers when a resend request was answered for an address.
 *
 * The tracker also covers addresses that do not exist, which keeps the resend
 * endpoint behaving exactly the same for registered and unknown addresses -
 * otherwise the response would reveal which addresses have an account.
 */
const resendAttempts = new Map();

const attemptKey = (email) =>
  crypto.createHash("sha256").update(normalizeEmail(email)).digest("hex");

/** Records that a resend request was just answered for this address. */
export const recordResendAttempt = (email) => {
  resendAttempts.set(attemptKey(email), Date.now());
};

/** Milliseconds left before another resend request may be answered. */
export const getResendAttemptCooldownMs = (email) => {
  const last = resendAttempts.get(attemptKey(email));

  if (!last) {
    return 0;
  }

  const remaining = RESEND_COOLDOWN_SECONDS * 1000 - (Date.now() - last);

  return remaining > 0 ? remaining : 0;
};

/** Clears the tracker. Used by the test suite. */
export const resetResendAttempts = () => {
  resendAttempts.clear();
};

// Drop stale entries so the map cannot grow forever.
setInterval(() => {
  const cutoff = Date.now() - RESEND_COOLDOWN_SECONDS * 1000;

  for (const [key, at] of resendAttempts) {
    if (at < cutoff) {
      resendAttempts.delete(key);
    }
  }
}, 60_000).unref();

/**
 * Milliseconds left before another verification email may be requested.
 * Zero when no email was sent recently.
 */
export const getCooldownRemainingMs = (user, now = Date.now()) => {
  if (!user?.verificationSentAt) {
    return 0;
  }

  const elapsed = now - new Date(user.verificationSentAt).getTime();
  const remaining = RESEND_COOLDOWN_SECONDS * 1000 - elapsed;

  return remaining > 0 ? remaining : 0;
};

/**
 * Issues a fresh verification code and emails it.
 *
 * The send slot is claimed with a single conditional UPDATE, so two
 * simultaneous requests can never produce two emails: only the request that
 * actually moves `verificationSentAt` forward is allowed to send.
 *
 * Returns `{ sent: false, cooldownRemainingMs }` when a code was already sent
 * inside the cooldown window.
 */
export const issueVerificationOtp = async (user) => {
  const now = new Date();
  const cooldownStart = new Date(
    now.getTime() - RESEND_COOLDOWN_SECONDS * 1000
  );

  const code = generateOtp();
  const codeHash = hashOtp(user.email, code);
  const codeExpiry = new Date(now.getTime() + OTP_TTL_MS);

  const claimed = await prisma.user.updateMany({
    where: {
      id: user.id,
      emailVerified: false,
      OR: [
        { verificationSentAt: null },
        { verificationSentAt: { lt: cooldownStart } },
      ],
    },
    data: {
      verificationCodeHash: codeHash,
      verificationCodeExpiry: codeExpiry,
      verificationSentAt: now,
      verificationAttempts: 0,
    },
  });

  if (claimed.count === 0) {
    // Somebody else claimed the slot a moment ago - reuse their code instead
    // of mailing a second one.
    const current = await prisma.user.findUnique({
      where: { id: user.id },
      select: { verificationSentAt: true },
    });

    return {
      sent: false,
      cooldownRemainingMs: getCooldownRemainingMs(current, now.getTime()),
    };
  }

  try {
    await sendVerificationEmail(user.email, user.username, code);
  } catch (error) {
    // The email never left the building, so the code must not stay active.
    await prisma.user.updateMany({
      where: { id: user.id, verificationSentAt: now },
      data: {
        verificationCodeHash: null,
        verificationCodeExpiry: null,
        verificationSentAt: null,
        verificationAttempts: 0,
      },
    });

    throw error;
  }

  return {
    sent: true,
    cooldownRemainingMs: RESEND_COOLDOWN_SECONDS * 1000,
  };
};
