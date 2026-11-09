import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetDatabase } from "./helpers.js";

const { sendVerificationEmailMock } = vi.hoisted(() => ({
  sendVerificationEmailMock: vi.fn(async () => ({ accepted: true })),
}));

// The mailer is replaced so that no real email is sent and so the generated
// code can be inspected by the assertions.
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
  username = "tester",
  email = "tester@example.com",
  password = PASSWORD,
  emailVerified = false,
  code = null,
  sentAt = null,
  attempts = 0,
} = {}) => {
  const now = Date.now();

  return prisma.user.create({
    data: {
      username,
      email,
      password: await bcrypt.hash(password, 10),
      emailVerified,
      verificationCodeHash: code ? hashOtp(email, code) : null,
      verificationCodeExpiry: code ? new Date(now + OTP_TTL_MS) : null,
      verificationSentAt: sentAt ? new Date(sentAt) : null,
      verificationAttempts: attempts,
    },
  });
};

/** The code that was handed to the (mocked) mailer for the given call. */
const sentCode = (callIndex = 0) => sendVerificationEmailMock.mock.calls[callIndex][2];

beforeEach(async () => {
  sendVerificationEmailMock.mockClear();
  sendVerificationEmailMock.mockResolvedValue({ accepted: true });

  // The resend cooldown is tracked in memory, so it has to be cleared between
  // the tests.
  resetResendAttempts();

  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /api/auth/register", () => {
  it("creates the account, mails one code and stores only a hash of it", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ username: "vaibhav", email: "vaibhav@example.com", password: PASSWORD });

    expect(response.status).toBe(201);
    expect(response.body.message).toMatch(/verify your email/i);

    expect(sendVerificationEmailMock).toHaveBeenCalledTimes(1);
    const [sentTo, username, code] = sendVerificationEmailMock.mock.calls[0];
    expect(sentTo).toBe("vaibhav@example.com");
    expect(username).toBe("vaibhav");
    expect(code).toMatch(/^\d{6}$/);

    const stored = await prisma.user.findUnique({
      where: { email: "vaibhav@example.com" },
    });

    expect(stored.emailVerified).toBe(false);
    expect(stored.verificationCodeHash).toBeTruthy();
    // The plaintext code must never be stored.
    expect(stored.verificationCodeHash).not.toBe(code);
    expect(JSON.stringify(stored)).not.toContain(code);

    // The code must never be echoed back to the client either.
    expect(JSON.stringify(response.body)).not.toContain(code);
  });

  it("normalises the email address", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ username: "mixed", email: "  Mixed.Case@Example.COM ", password: PASSWORD });

    expect(response.status).toBe(201);

    const stored = await prisma.user.findUnique({
      where: { email: "mixed.case@example.com" },
    });

    expect(stored).not.toBeNull();
    expect(sendVerificationEmailMock.mock.calls[0][0]).toBe("mixed.case@example.com");
  });

  it("rejects a duplicate email", async () => {
    await createUser({ username: "taken", email: "taken@example.com" });

    const response = await request(app)
      .post("/api/auth/register")
      .send({ username: "other", email: "taken@example.com", password: PASSWORD });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/already exists/i);
    expect(sendVerificationEmailMock).not.toHaveBeenCalled();
  });

  it("rejects a duplicate username", async () => {
    await createUser({ username: "taken", email: "taken@example.com" });

    const response = await request(app)
      .post("/api/auth/register")
      .send({ username: "taken", email: "fresh@example.com", password: PASSWORD });

    expect(response.status).toBe(400);
    expect(sendVerificationEmailMock).not.toHaveBeenCalled();
  });

  it.each([
    ["a malformed email", { username: "u1", email: "not-an-email", password: PASSWORD }, /valid email/i],
    ["a short password", { username: "user2", email: "u2@example.com", password: "123" }, /at least 6 characters/i],
    ["a short username", { username: "ab", email: "u3@example.com", password: PASSWORD }, /username must be between/i],
    ["a missing field", { username: "u4", password: PASSWORD }, /all fields are required/i],  ])("rejects %s", async (_label, payload, expected) => {
    const response = await request(app).post("/api/auth/register").send(payload);

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(expected);
    expect(sendVerificationEmailMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/login", () => {
  it("logs a verified user in and never leaks the password", async () => {
    await createUser({
      username: "verified",
      email: "verified@example.com",
      emailVerified: true,
    });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "verified@example.com", password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user.email).toBe("verified@example.com");
    expect(response.body.user.password).toBeUndefined();
    expect(response.body.user.verificationCodeHash).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain(PASSWORD);
  });

  it("automatically mails a code when the account is not verified yet", async () => {
    await createUser({ username: "unverified", email: "unverified@example.com" });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "unverified@example.com", password: PASSWORD });

    expect(response.status).toBe(403);
    expect(response.body.requiresVerification).toBe(true);
    expect(response.body.codeSent).toBe(true);
    expect(response.body.cooldownRemaining).toBe(30);
    expect(response.body.message).toMatch(/sent a 6-digit code/i);

    expect(sendVerificationEmailMock).toHaveBeenCalledTimes(1);
    expect(sentCode()).toMatch(/^\d{6}$/);
    expect(JSON.stringify(response.body)).not.toContain(sentCode());

    const stored = await prisma.user.findUnique({
      where: { email: "unverified@example.com" },
    });
    expect(stored.verificationCodeHash).toBeTruthy();
    expect(stored.verificationSentAt).not.toBeNull();
  });

  it("does not mail a second code for a repeated login attempt", async () => {
    await createUser({ username: "unverified", email: "unverified@example.com" });

    await request(app)
      .post("/api/auth/login")
      .send({ email: "unverified@example.com", password: PASSWORD });

    const second = await request(app)
      .post("/api/auth/login")
      .send({ email: "unverified@example.com", password: PASSWORD });

    expect(second.status).toBe(403);
    expect(second.body.codeSent).toBe(false);
    expect(second.body.cooldownRemaining).toBeGreaterThan(0);
    expect(sendVerificationEmailMock).toHaveBeenCalledTimes(1);
  });

  it("never mails a code when the password is wrong", async () => {
    await createUser({ username: "unverified", email: "unverified@example.com" });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "unverified@example.com", password: "wrong-password" });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/invalid email or password/i);
    expect(sendVerificationEmailMock).not.toHaveBeenCalled();
  });

  it("never mails a code for an unknown address", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "ghost@example.com", password: PASSWORD });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/invalid email or password/i);
    expect(sendVerificationEmailMock).not.toHaveBeenCalled();
  });

  it("rejects a missing password", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "unverified@example.com" });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/all fields are required/i);
    expect(sendVerificationEmailMock).not.toHaveBeenCalled();
  });

  it("logs the user in once the address has been verified", async () => {
    await createUser({
      username: "unverified",
      email: "unverified@example.com",
      code: "123456",
      sentAt: Date.now(),
    });

    await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "unverified@example.com", code: "123456" });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "unverified@example.com", password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(sendVerificationEmailMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/verify-email", () => {
  it("verifies the account with the mailed code", async () => {
    await createUser({
      username: "unverified",
      email: "unverified@example.com",
      code: "123456",
      sentAt: Date.now(),
    });

    const response = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "unverified@example.com", code: "123456" });

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/verified successfully/i);

    const stored = await prisma.user.findUnique({
      where: { email: "unverified@example.com" },
    });

    expect(stored.emailVerified).toBe(true);
    expect(stored.verificationCodeHash).toBeNull();
    expect(stored.verificationCodeExpiry).toBeNull();
    expect(stored.verificationAttempts).toBe(0);
  });

  it("counts a wrong code and keeps the pending code alive", async () => {
    await createUser({
      username: "unverified",
      email: "unverified@example.com",
      code: "123456",
      sentAt: Date.now(),
    });

    const response = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "unverified@example.com", code: "654321" });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/invalid or expired verification code/i);

    const stored = await prisma.user.findUnique({
      where: { email: "unverified@example.com" },
    });

    expect(stored.verificationAttempts).toBe(1);
    expect(stored.emailVerified).toBe(false);
  });

  it("drops the code after too many wrong attempts", async () => {
    await createUser({
      username: "unverified",
      email: "unverified@example.com",
      code: "123456",
      sentAt: Date.now(),
    });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await request(app)
        .post("/api/auth/verify-email")
        .send({ email: "unverified@example.com", code: "000000" });

      expect(response.status).toBe(400);
    }

    const locked = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "unverified@example.com", code: "000000" });

    expect(locked.status).toBe(400);
    expect(locked.body.message).toMatch(/invalid or expired verification code/i);

    // The correct code is worthless once the code has been burned.
    const retry = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "unverified@example.com", code: "123456" });

    expect(retry.status).toBe(400);
    expect(retry.body.message).toMatch(/invalid or expired verification code/i);
  });

  it("rejects an expired code and clears it", async () => {
    await createUser({
      username: "unverified",
      email: "unverified@example.com",
      code: "123456",
      sentAt: Date.now(),
    });

    await prisma.user.update({
      where: { email: "unverified@example.com" },
      data: { verificationCodeExpiry: new Date(Date.now() - 1000) },
    });

    const response = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "unverified@example.com", code: "123456" });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/invalid or expired verification code/i);

    const stored = await prisma.user.findUnique({
      where: { email: "unverified@example.com" },
    });

    expect(stored.verificationCodeHash).toBeNull();
    expect(stored.emailVerified).toBe(false);
  });

  it("rejects a malformed code", async () => {
    await createUser({
      username: "unverified",
      email: "unverified@example.com",
      code: "123456",
      sentAt: Date.now(),
    });

    const response = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "unverified@example.com", code: "12" });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/6 digits/i);
  });

  it("answers an unknown address exactly like a wrong code", async () => {
    const response = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "ghost@example.com", code: "123456" });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/invalid or expired verification code/i);
  });

  it("answers an already verified address exactly like a wrong code", async () => {
    await createUser({
      username: "verified",
      email: "verified@example.com",
      emailVerified: true,
    });

    const response = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "verified@example.com", code: "123456" });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/invalid or expired verification code/i);
  });
});

describe("POST /api/auth/resend-verification", () => {
  it("mails a new code when no code was sent yet", async () => {
    await createUser({ username: "unverified", email: "unverified@example.com" });

    const response = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "unverified@example.com" });

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/new code has been sent/i);
    expect(response.body.cooldownRemaining).toBe(30);
    expect(sendVerificationEmailMock).toHaveBeenCalledTimes(1);
  });

  it("refuses a resend inside the cooldown window", async () => {
    await createUser({
      username: "unverified",
      email: "unverified@example.com",
    });

    const first = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "unverified@example.com" });

    expect(first.status).toBe(200);

    const response = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "unverified@example.com" });

    expect(response.status).toBe(429);
    expect(response.body.retryAfter).toBeGreaterThan(0);
    expect(response.body.retryAfter).toBeLessThanOrEqual(30);
    expect(response.body.message).toMatch(/please wait/i);
    expect(sendVerificationEmailMock).toHaveBeenCalledTimes(1);
  });

  it("does not mail a second code when one was sent a moment ago", async () => {
    await createUser({
      username: "unverified",
      email: "unverified@example.com",
      sentAt: Date.now(),
    });

    const response = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "unverified@example.com" });

    // The answer looks the same as for any other address.
    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/new code has been sent/i);

    // The code that was sent a moment ago is still the valid one.
    expect(sendVerificationEmailMock).not.toHaveBeenCalled();
  });

  it("allows a resend once the cooldown has elapsed", async () => {
    await createUser({
      username: "unverified",
      email: "unverified@example.com",
      sentAt: Date.now() - 31_000,
    });

    const response = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "unverified@example.com" });

    expect(response.status).toBe(200);
    expect(sendVerificationEmailMock).toHaveBeenCalledTimes(1);
    expect(sentCode()).toMatch(/^\d{6}$/);
  });

  it("only mails one code when two resend requests race", async () => {
    await createUser({
      username: "unverified",
      email: "unverified@example.com",
      sentAt: Date.now() - 31_000,
    });

    const [first, second] = await Promise.all([
      request(app).post("/api/auth/resend-verification").send({ email: "unverified@example.com" }),
      request(app).post("/api/auth/resend-verification").send({ email: "unverified@example.com" }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 429]);
    expect(sendVerificationEmailMock).toHaveBeenCalledTimes(1);
  });

  it("answers a verified address exactly like any other address", async () => {
    await createUser({
      username: "verified",
      email: "verified@example.com",
      emailVerified: true,
    });

    const response = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "verified@example.com" });

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/new code has been sent/i);
    expect(sendVerificationEmailMock).not.toHaveBeenCalled();
  });

  it("rejects a missing email", async () => {
    const response = await request(app)
      .post("/api/auth/resend-verification")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/email is required/i);
  });

  it("answers an unknown address exactly like a registered one", async () => {
    const response = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "ghost@example.com" });

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/new code has been sent/i);
    expect(sendVerificationEmailMock).not.toHaveBeenCalled();
  });
});

describe("malformed requests", () => {
  it.each([
    ["/api/auth/register", { username: "u", email: "u@example.com", password: PASSWORD }],
    ["/api/auth/login", { email: "u@example.com", password: PASSWORD }],
    ["/api/auth/verify-email", { email: "u@example.com", code: "123456" }],
    ["/api/auth/resend-verification", { email: "u@example.com" }],
  ])("%s answers with 400 when the body is empty", async (path) => {
    const response = await request(app).post(path).send();

    expect(response.status).toBe(400);
    expect(response.body.message).toEqual(expect.any(String));
    expect(sendVerificationEmailMock).not.toHaveBeenCalled();
  });
});

describe("registration -> login -> verification flow", () => {
  it("verifies the account with the code that was mailed at registration", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ username: "flow", email: "flow@example.com", password: PASSWORD });

    const code = sentCode();

    const verified = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "flow@example.com", code });

    expect(verified.status).toBe(200);

    const loggedIn = await request(app)
      .post("/api/auth/login")
      .send({ email: "flow@example.com", password: PASSWORD });

    expect(loggedIn.status).toBe(200);
    expect(loggedIn.body.token).toEqual(expect.any(String));
  });

  it("keeps the code usable when the login attempt re-sends it", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ username: "flow2", email: "flow2@example.com", password: PASSWORD });

    const code = sentCode();

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "flow2@example.com", password: PASSWORD });

    expect(login.status).toBe(403);
    expect(login.body.codeSent).toBe(false);

    const verified = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "flow2@example.com", code });

    expect(verified.status).toBe(200);
  });
});
