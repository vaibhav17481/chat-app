import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetDatabase } from "./helpers.js";

const { sendVerificationEmailMock } = vi.hoisted(() => ({
  sendVerificationEmailMock: vi.fn(async () => ({ accepted: true })),
}));

vi.mock("../src/services/email.service.js", () => ({
  sendVerificationEmail: sendVerificationEmailMock,
}));

const { default: prisma } = await import("../src/lib/prisma.js");
const { default: app } = await import("../src/app.js");
const { hashOtp, OTP_TTL_MS } = await import("../src/services/otp.service.js");
const { resetResendAttempts } = await import(
  "../src/services/verification.service.js"
);

const PASSWORD = "password123";

const createUser = async ({
  username = "known",
  email = "known@example.com",
  emailVerified = false,
  code = null,
  sentAt = null,
} = {}) =>
  prisma.user.create({
    data: {
      username,
      email,
      password: await bcrypt.hash(PASSWORD, 10),
      emailVerified,
      verificationCodeHash: code ? hashOtp(email, code) : null,
      verificationCodeExpiry: code ? new Date(Date.now() + OTP_TTL_MS) : null,
      verificationSentAt: sentAt ? new Date(sentAt) : null,
    },
  });

const post = (path, body) =>
  request(app).post(path).send(body ?? {});

beforeEach(async () => {
  sendVerificationEmailMock.mockClear();
  sendVerificationEmailMock.mockResolvedValue({ accepted: true });

  resetResendAttempts();

  await prisma.refreshToken.deleteMany();
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("the resend endpoint does not reveal which addresses exist", () => {
  it("answers a registered and an unknown address the same way", async () => {
    await createUser({ username: "known", email: "known@example.com" });

    const known = await post("/api/auth/resend-verification", {
      email: "known@example.com",
    });
    const unknown = await post("/api/auth/resend-verification", {
      email: "unknown@example.com",
    });

    expect(known.status).toBe(unknown.status);
    expect(known.body.message).toBe(unknown.body.message);
    expect(known.body.cooldownRemaining).toBe(unknown.body.cooldownRemaining);
  });

  it("answers a verified and an unknown address the same way", async () => {
    await createUser({
      username: "verified",
      email: "verified@example.com",
      emailVerified: true,
    });

    const verified = await post("/api/auth/resend-verification", {
      email: "verified@example.com",
    });
    const unknown = await post("/api/auth/resend-verification", {
      email: "unknown@example.com",
    });

    expect(verified.status).toBe(unknown.status);
    expect(verified.body.message).toBe(unknown.body.message);
    expect(sendVerificationEmailMock).not.toHaveBeenCalled();
  });

  it("answers the second request the same way for both kinds of address", async () => {
    await createUser({ username: "known", email: "known@example.com" });

    await post("/api/auth/resend-verification", { email: "known@example.com" });
    await post("/api/auth/resend-verification", { email: "unknown@example.com" });

    const known = await post("/api/auth/resend-verification", {
      email: "known@example.com",
    });
    const unknown = await post("/api/auth/resend-verification", {
      email: "unknown@example.com",
    });

    expect(known.status).toBe(429);
    expect(unknown.status).toBe(429);
    expect(known.body.message).toBe(unknown.body.message);
  });

  it("never mails a code to an address that does not exist", async () => {
    const response = await post("/api/auth/resend-verification", {
      email: "unknown@example.com",
    });

    expect(response.status).toBe(200);
    expect(sendVerificationEmailMock).not.toHaveBeenCalled();
  });
});

describe("the verification endpoint does not reveal which addresses exist", () => {
  it("answers an unknown address like a wrong code", async () => {
    await createUser({
      username: "known",
      email: "known@example.com",
      code: "123456",
      sentAt: Date.now(),
    });

    const unknown = await post("/api/auth/verify-email", {
      email: "unknown@example.com",
      code: "123456",
    });
    const wrong = await post("/api/auth/verify-email", {
      email: "known@example.com",
      code: "654321",
    });

    expect(unknown.status).toBe(wrong.status);
    expect(unknown.body.message).toBe(wrong.body.message);
  });

  it("answers a verified address like a wrong code", async () => {
    await createUser({
      username: "verified",
      email: "verified@example.com",
      emailVerified: true,
    });

    const verified = await post("/api/auth/verify-email", {
      email: "verified@example.com",
      code: "123456",
    });
    const unknown = await post("/api/auth/verify-email", {
      email: "unknown@example.com",
      code: "123456",
    });

    expect(verified.status).toBe(unknown.status);
    expect(verified.body.message).toBe(unknown.body.message);
  });

  it("never confirms that an address is registered", async () => {
    const response = await post("/api/auth/verify-email", {
      email: "unknown@example.com",
      code: "123456",
    });

    expect(JSON.stringify(response.body).toLowerCase()).not.toMatch(
      /not found|no verification code|already verified|unknown email/
    );
  });
});

describe("the login endpoint does not reveal which addresses exist", () => {
  it("answers an unknown address like a wrong password", async () => {
    await createUser({
      username: "known",
      email: "known@example.com",
      emailVerified: true,
    });

    const unknown = await post("/api/auth/login", {
      email: "unknown@example.com",
      password: PASSWORD,
    });
    const wrong = await post("/api/auth/login", {
      email: "known@example.com",
      password: "not-the-password",
    });

    expect(unknown.status).toBe(wrong.status);
    expect(unknown.body.message).toBe(wrong.body.message);
  });
});
