import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

const { createRateLimiter } = await import(
  "../src/middleware/rateLimit.middleware.js"
);

const buildApp = (limiter) => {
  const app = express();

  app.use(express.json());
  app.post("/limited", limiter, (req, res) => {
    res.status(200).json({ message: "ok" });
  });

  return app;
};

describe("rate limiter", () => {
  it("answers with 429 once the limit is reached", async () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 3,
      skipInTest: false,
      message: "Too many requests. Please try again later.",
    });

    const app = buildApp(limiter);

    const statuses = [];

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app).post("/limited").send({});

      statuses.push(response.status);
    }

    expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
    expect(statuses.slice(3)).toEqual([429, 429]);
  });

  it("reports how long the caller has to wait", async () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 1,
      skipInTest: false,
    });

    const app = buildApp(limiter);

    await request(app).post("/limited").send({});

    const blocked = await request(app).post("/limited").send({});

    expect(blocked.status).toBe(429);
    expect(blocked.headers["retry-after"]).toBeDefined();
    expect(blocked.body.message).toEqual(expect.any(String));
  });

  it("is skipped in the test environment by default", async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });

    const app = buildApp(limiter);

    const statuses = [];

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await request(app).post("/limited").send({});

      statuses.push(response.status);
    }

    expect(statuses).toEqual([200, 200, 200]);
  });
});

describe("authentication endpoints are limited", () => {
  it("blocks the login endpoint once the limit is reached", async () => {
    const { default: authRoutes } = await import("../src/routes/auth.routes.js");

    const app = express();

    app.use(express.json());
    app.use(
      "/api/auth",
      createRateLimiter({ windowMs: 60_000, max: 2, skipInTest: false }),
      authRoutes
    );

    const attempt = () =>
      request(app)
        .post("/api/auth/login")
        .send({ email: "nobody@example.com", password: "password123" });

    expect((await attempt()).status).toBe(400);
    expect((await attempt()).status).toBe(400);

    const blocked = await attempt();

    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/too many/i);
  });

  it("blocks the verification endpoint once the limit is reached", async () => {
    const { default: authRoutes } = await import("../src/routes/auth.routes.js");

    const app = express();

    app.use(express.json());
    app.use(
      "/api/auth",
      createRateLimiter({ windowMs: 60_000, max: 1, skipInTest: false }),
      authRoutes
    );

    const attempt = () =>
      request(app)
        .post("/api/auth/verify-email")
        .send({ email: "nobody@example.com", code: "123456" });

    expect((await attempt()).status).toBe(400);

    const blocked = await attempt();

    expect(blocked.status).toBe(429);
  });
});
