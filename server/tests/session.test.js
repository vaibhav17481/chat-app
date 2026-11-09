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

const PASSWORD = "password123";

const createVerifiedUser = async ({
  username = "session",
  email = "session@example.com",
} = {}) =>
  prisma.user.create({
    data: {
      username,
      email,
      password: await bcrypt.hash(PASSWORD, 10),
      emailVerified: true,
    },
  });

const login = async (email = "session@example.com") => {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email, password: PASSWORD });

  return response;
};

const cookieFrom = (response) =>
  (response.headers["set-cookie"] ?? []).find((cookie) =>
    cookie.startsWith("refresh_token=")
  );

beforeEach(async () => {
  sendVerificationEmailMock.mockClear();
  sendVerificationEmailMock.mockResolvedValue({ accepted: true });

  await prisma.refreshToken.deleteMany();
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("session cookies", () => {
  it("hands out an httpOnly refresh cookie on login", async () => {
    await createVerifiedUser();

    const response = await login();

    expect(response.status).toBe(200);

    const cookie = cookieFrom(response);

    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/api\/auth/i);
  });

  it("never puts the refresh token into the response body", async () => {
    await createVerifiedUser();

    const response = await login();

    expect(response.body.token).toEqual(expect.any(String));
    expect(JSON.stringify(response.body)).not.toContain("refresh_token");
  });

  it("stores only the hash of the refresh token", async () => {
    await createVerifiedUser();

    await login();

    const stored = await prisma.refreshToken.findMany();

    expect(stored).toHaveLength(1);
    expect(stored[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored[0].revokedAt).toBeNull();

    const raw = cookieFrom(await login()).split(";")[0].split("=")[1];

    expect(stored.map((entry) => entry.tokenHash)).not.toContain(raw);
  });
});

describe("POST /api/auth/refresh", () => {
  it("renews the access token with the refresh cookie", async () => {
    await createVerifiedUser();

    const loginResponse = await login();

    const refreshed = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookieFrom(loginResponse));

    expect(refreshed.status).toBe(200);
    expect(refreshed.body.token).toEqual(expect.any(String));
    expect(refreshed.body.user.email).toBe("session@example.com");
    expect(cookieFrom(refreshed)).toBeDefined();
  });

  it("rotates the refresh token so the old one cannot be used twice", async () => {
    await createVerifiedUser();

    const loginResponse = await login();
    const oldCookie = cookieFrom(loginResponse);

    const refreshed = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", oldCookie);

    expect(refreshed.status).toBe(200);

    const replay = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", oldCookie);

    expect(replay.status).toBe(401);
    expect(replay.body.message).toMatch(/session expired/i);
  });

  it("rejects a refresh without a cookie", async () => {
    const response = await request(app).post("/api/auth/refresh");

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/session expired/i);
  });

  it("rejects a refresh with a made up token", async () => {
    const response = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", "refresh_token=not-a-real-token");

    expect(response.status).toBe(401);
  });

  it("issues an access token that works on a protected route", async () => {
    await createVerifiedUser();

    const refreshed = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookieFrom(await login()));

    const profile = await request(app)
      .get("/api/users/profile")
      .set("Authorization", `Bearer ${refreshed.body.token}`);

    expect(profile.status).toBe(200);
    expect(profile.body.email).toBe("session@example.com");
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes the refresh token so the session cannot continue", async () => {
    await createVerifiedUser();

    const loginResponse = await login();

    const loggedOut = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", cookieFrom(loginResponse));

    expect(loggedOut.status).toBe(200);

    const refreshed = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookieFrom(loginResponse));

    expect(refreshed.status).toBe(401);
  });

  it("clears the cookie", async () => {
    await createVerifiedUser();

    const loggedOut = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", cookieFrom(await login()));

    const cookie = cookieFrom(loggedOut);

    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/refresh_token=;/);
    expect(cookie).toMatch(/HttpOnly/i);
  });
});
