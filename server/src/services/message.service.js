import prisma from "../lib/prisma.js";
import { emitToUsers } from "../sockets/socket.js";

// Every message that leaves the API carries its reply target and its
// reactions. Reactions are returned as raw rows (userId + emoji) so the very
// same payload can be broadcast to both participants of a conversation - each
// client works out on its own which reactions belong to them.
export const MESSAGE_RELATIONS = {
  sender: {
    select: { id: true, username: true, displayName: true },
  },
  replyTo: {
    select: {
      id: true,
      senderId: true,
      content: true,
      deleted: true,
      createdAt: true,
      sender: {
        select: { id: true, username: true, displayName: true },
      },
    },
  },
  reactions: {
    select: { id: true, userId: true, emoji: true },
    orderBy: { createdAt: "asc" },
  },
};

export const getReactions = (messageId) => {
  return prisma.reaction.findMany({
    where: { messageId: Number(messageId) },
    select: { id: true, userId: true, emoji: true },
    orderBy: { createdAt: "asc" },
  });
};

// A user may only touch messages that belong to one of their conversations.
export const isParticipant = (message, userId) => {
  if (!message) return false;

  const id = Number(userId);

  return message.senderId === id || message.receiverId === id;
};

// Both sides of a conversation have to see a change in real time.
export const notifyParticipants = (event, payload, message) => {
  if (!message) return;

  emitToUsers(event, payload, [message.senderId, message.receiverId]);
};
