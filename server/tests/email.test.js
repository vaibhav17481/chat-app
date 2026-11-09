import bcrypt from "bcrypt";
import { SMTPServer } from "smtp-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { resetDatabase } from "./helpers.js";

const { default: prisma } = await import("../src/lib/prisma.js");
const { default: app } = await import("../src/app.js");
const { verifyOtp } = await import("../src/services/otp.service.js");

/**
 * These tests use a real SMTP server instead of a mocked mailer, so the whole
 * delivery path (nodemailer -> transport -> message body) is exercised.
 */
const messages = [];
let smtpServer;
let previousEnv;

beforeAll(async () => {
  previousEnv = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_APP_PASSWORD: process.env.EMAIL_APP_PASSWORD,
  };

  smtpServer = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS", "AUTH"],
    onData(stream, session, callback) {
      let data = "";

      stream.on("data", (chunk) => {
        data += chunk.toString();
      });

      stream.on("end", () => {
        messages.push(data);
        callback();
      });
    },
  });

  await new Promise((resolve) => {
    smtpServer.listen(0, "127.0.0.1", resolve);
  });

  process.env.SMTP_HOST = "127.0.0.1";
  process.env.SMTP_PORT = String(smtpServer.server.address().port);
  process.env.EMAIL_USER = "mailer@example.com";
  process.env.EMAIL_APP_PASSWORD = "mailer-password";
});

afterAll(async () => {
  await new Promise((resolve) => smtpServer.close(resolve));

  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  await prisma.$disconnect();
});

beforeEach(async () => {
  messages.length = 0;

  await resetDatabase();
});

/** Extracts the six digit code from the delivered message. */
const deliveredCode = () => {
  const body = messages[0] || "";

  const match = body.match(/verification code is:?\s*(\d{6})/i);

  return match ? match[1] : null;
};

describe("verification email delivery", () => {
  it("delivers a code that matches the stored hash", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        username: "mailbox",
        email: "mailbox@example.com",
        password: "password123",
      });

    expect(response.status).toBe(201);
    expect(messages).toHaveLength(1);

    const code = deliveredCode();

    expect(code).toMatch(/^\d{6}$/);

    const stored = await prisma.user.findUnique({
      where: { email: "mailbox@example.com" },
    });

    // The code that arrived in the inbox is the one that verifies the account.
    expect(verifyOtp("mailbox@example.com", code, stored.verificationCodeHash)).toBe(
      true
    );

    const verified = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "mailbox@example.com", code });

    expect(verified.status).toBe(200);
  });

  it("delivers a fresh code on an unverified login attempt", async () => {
    await prisma.user.create({
      data: {
        username: "mailbox2",
        email: "mailbox2@example.com",
        password: await bcrypt.hash("password123", 10),
        emailVerified: false,
      },
    });

    await request(app)
      .post("/api/auth/login")
      .send({ email: "mailbox2@example.com", password: "password123" });

    expect(messages).toHaveLength(1);
    expect(deliveredCode()).toMatch(/^\d{6}$/);
  });
});
