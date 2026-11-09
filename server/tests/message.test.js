import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { resetDatabase } from "./helpers.js";

const { default: prisma } = await import("../src/lib/prisma.js");
const { default: app } = await import("../src/app.js");
const { signAccessToken } = await import("../src/services/token.service.js");

const PASSWORD = "password123";

const createUser = async (username) =>
  prisma.user.create({
    data: {
      username,
      email: `${username}@example.com`,
      password: await bcrypt.hash(PASSWORD, 10),
      emailVerified: true,
    },
  });

const befriend = async (user1Id, user2Id) =>
  prisma.friend.create({
    data: { user1Id, user2Id },
  });

const auth = (user) => ({
  Authorization: `Bearer ${signAccessToken(user.id)}`,
});

const sendMessage = (user, receiverId, content, extra = {}) =>
  request(app)
    .post("/api/messages")
    .set(auth(user))
    .send({ receiverId, content, ...extra });

const react = (user, messageId, emoji) =>
  request(app)
    .post(`/api/messages/${messageId}/reactions`)
    .set(auth(user))
    .send({ emoji });

let alice;
let bob;
let carol;

beforeEach(async () => {
  await resetDatabase();

  alice = await createUser("alice");
  bob = await createUser("bob");
  carol = await createUser("carol");

  await befriend(alice.id, bob.id);
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

describe("message replies", () => {
  it("stores the reply target and returns it with the message", async () => {
    const original = await sendMessage(alice, bob.id, "first message");

    const reply = await sendMessage(bob, alice.id, "my answer", {
      replyToId: original.body.data.id,
    });

    expect(reply.status).toBe(201);
    expect(reply.body.data.replyToId).toBe(original.body.data.id);
    expect(reply.body.data.replyTo.id).toBe(original.body.data.id);
    expect(reply.body.data.replyTo.content).toBe("first message");
    expect(reply.body.data.replyTo.sender.username).toBe("alice");
    expect(reply.body.data.reactions).toEqual([]);
  });

  it("returns the reply target inside the conversation", async () => {
    const original = await sendMessage(alice, bob.id, "first message");
    await sendMessage(bob, alice.id, "my answer", {
      replyToId: original.body.data.id,
    });

    const conversation = await request(app)
      .get(`/api/messages/${alice.id}`)
      .set(auth(bob));

    expect(conversation.status).toBe(200);

    const reply = conversation.body.find((m) => m.content === "my answer");

    expect(reply.replyTo.content).toBe("first message");
    expect(reply.replyTo.sender.username).toBe("alice");
    expect(conversation.body.find((m) => m.content === "first message").replyTo).toBeNull();
  });

  it("refuses a reply to a message of another conversation", async () => {
    await befriend(bob.id, carol.id);

    const otherConversation = await sendMessage(bob, carol.id, "secret");

    const reply = await sendMessage(alice, bob.id, "let me in", {
      replyToId: otherConversation.body.data.id,
    });

    expect(reply.status).toBe(403);
    expect(reply.body.message).toMatch(/reply to messages in this conversation/i);
  });

  it("refuses a reply to a message that does not exist", async () => {
    const reply = await sendMessage(alice, bob.id, "hello?", {
      replyToId: 999999,
    });

    expect(reply.status).toBe(404);
    expect(reply.body.message).toMatch(/no longer exists/i);
  });

  it("refuses a reply to a deleted message", async () => {
    const original = await sendMessage(alice, bob.id, "oops");

    await request(app)
      .delete(`/api/messages/${original.body.data.id}`)
      .set(auth(alice));

    const reply = await sendMessage(bob, alice.id, "what happened?", {
      replyToId: original.body.data.id,
    });

    expect(reply.status).toBe(400);
    expect(reply.body.message).toMatch(/was deleted/i);
  });

  it("still requires the sender to be a friend of the receiver", async () => {
    const reply = await sendMessage(carol, alice.id, "hi", {
      replyToId: 1,
    });

    expect(reply.status).toBe(403);
    expect(reply.body.message).toMatch(/only message your friends/i);
  });
});

describe("message reactions", () => {
  it("adds a reaction and persists it", async () => {
    const message = await sendMessage(alice, bob.id, "hello");

    const response = await react(bob, message.body.data.id, "👍");

    expect(response.status).toBe(200);
    expect(response.body.data.reactions).toHaveLength(1);
    expect(response.body.data.reactions[0]).toMatchObject({
      userId: bob.id,
      emoji: "👍",
    });
    expect(response.body.data.mine).toBe("👍");

    const stored = await prisma.reaction.findMany({
      where: { messageId: message.body.data.id },
    });

    expect(stored).toHaveLength(1);
  });

  it("removes the reaction when the same emoji is picked again", async () => {
    const message = await sendMessage(alice, bob.id, "hello");

    await react(bob, message.body.data.id, "👍");

    const response = await react(bob, message.body.data.id, "👍");

    expect(response.status).toBe(200);
    expect(response.body.data.reactions).toHaveLength(0);
    expect(response.body.data.mine).toBeNull();

    const stored = await prisma.reaction.findMany({
      where: { messageId: message.body.data.id },
    });

    expect(stored).toHaveLength(0);
  });

  it("changes an existing reaction instead of stacking a second one", async () => {
    const message = await sendMessage(alice, bob.id, "hello");

    await react(bob, message.body.data.id, "👍");

    const response = await react(bob, message.body.data.id, "❤️");

    expect(response.status).toBe(200);
    expect(response.body.data.reactions).toHaveLength(1);
    expect(response.body.data.reactions[0].emoji).toBe("❤️");

    const stored = await prisma.reaction.findMany({
      where: { messageId: message.body.data.id },
    });

    expect(stored).toHaveLength(1);
    expect(stored[0].emoji).toBe("❤️");
  });

  it("never stores the same reaction twice for the same user", async () => {
    const message = await sendMessage(alice, bob.id, "hello");

    // add -> remove -> add again
    await react(bob, message.body.data.id, "👍");
    await react(bob, message.body.data.id, "👍");
    await react(bob, message.body.data.id, "👍");

    const stored = await prisma.reaction.findMany({
      where: { messageId: message.body.data.id },
    });

    expect(stored).toHaveLength(1);
    expect(stored[0].emoji).toBe("👍");

    // the database refuses a duplicated (message, user, emoji) triple
    await expect(
      prisma.reaction.create({
        data: {
          messageId: message.body.data.id,
          userId: bob.id,
          emoji: "👍",
        },
      })
    ).rejects.toThrow();
  });

  it("counts the reactions of different users separately", async () => {
    const message = await sendMessage(alice, bob.id, "hello");

    await react(bob, message.body.data.id, "👍");
    const response = await react(alice, message.body.data.id, "👍");

    expect(response.status).toBe(200);
    expect(response.body.data.reactions).toHaveLength(2);
    expect(
      response.body.data.reactions.filter((r) => r.emoji === "👍")
    ).toHaveLength(2);
  });

  it("returns the reactions inside the conversation", async () => {
    const message = await sendMessage(alice, bob.id, "hello");

    await react(bob, message.body.data.id, "🔥");

    const conversation = await request(app)
      .get(`/api/messages/${bob.id}`)
      .set(auth(alice));

    const stored = conversation.body.find((m) => m.id === message.body.data.id);

    expect(stored.reactions).toHaveLength(1);
    expect(stored.reactions[0]).toMatchObject({ userId: bob.id, emoji: "🔥" });
  });

  it("refuses a reaction on a message of another conversation", async () => {
    await befriend(bob.id, carol.id);

    const conversation = await sendMessage(alice, bob.id, "private");

    const response = await react(carol, conversation.body.data.id, "👍");

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/only react to messages in your conversations/i);
  });

  it("refuses a reaction on a message that does not exist", async () => {
    const response = await react(bob, 999999, "👍");

    expect(response.status).toBe(404);
    expect(response.body.message).toMatch(/not found/i);
  });

  it("refuses anything that is not an emoji", async () => {
    const message = await sendMessage(alice, bob.id, "hello");

    const response = await react(bob, message.body.data.id, "not-an-emoji");

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/invalid emoji/i);
  });

  it("refuses an empty emoji", async () => {
    const message = await sendMessage(alice, bob.id, "hello");

    const response = await react(bob, message.body.data.id, "   ");

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/emoji is required/i);
  });

  it("requires authentication", async () => {
    const message = await sendMessage(alice, bob.id, "hello");

    const response = await request(app)
      .post(`/api/messages/${message.body.data.id}/reactions`)
      .send({ emoji: "👍" });

    expect(response.status).toBe(401);
  });

  it("clears the reactions of a deleted message", async () => {
    const message = await sendMessage(alice, bob.id, "hello");

    await react(bob, message.body.data.id, "👍");

    const deleted = await request(app)
      .delete(`/api/messages/${message.body.data.id}`)
      .set(auth(alice));

    expect(deleted.status).toBe(200);
    expect(deleted.body.data.reactions).toEqual([]);

    const stored = await prisma.reaction.findMany({
      where: { messageId: message.body.data.id },
    });

    expect(stored).toHaveLength(0);
  });
});
