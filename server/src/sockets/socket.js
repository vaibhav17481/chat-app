import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

let io;

const userSocketMap = {};

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // The socket is authenticated with the same access token the API uses.
  // The client can no longer claim an identity it does not own.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Unauthorized - Missing Token"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      socket.userId = decoded.userId;

      return next();
    } catch {
      return next(new Error("Unauthorized - Invalid Token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.userId;

    console.log("User connected:", socket.id);

    socket.on("join", async () => {
      userSocketMap[userId] = socket.id;

      // Mark any previously "sent" messages as delivered now that the user is online
      try {
        const delivered = await prisma.message.updateMany({
          where: {
            receiverId: userId,
            status: "SENT",
          },
          data: {
            status: "DELIVERED",
          },
        });

        if (delivered.count > 0) {
          const messages = await prisma.message.findMany({
            where: {
              receiverId: userId,
              status: "DELIVERED",
            },
            select: { id: true },
          });

          messages.forEach(({ id }) => {
            socket.broadcast.emit("messageStatus", {
              messageId: id,
              status: "DELIVERED",
            });
          });
        }
      } catch (error) {
        console.log("Failed to mark messages as delivered:", error);
      }

      socket.on("typing", ({ receiverId }) => {
        const receiverSocketId = userSocketMap[receiverId];

        if (receiverSocketId) {
          io.to(receiverSocketId).emit("userTyping", {
            senderId: userId,
          });
        }
      });

      // Receiver tells the server which conversation they are reading,
      // so all of that friend's messages become "READ".
      socket.on("markSeen", async ({ friendId }) => {
        try {
          const result = await prisma.message.updateMany({
            where: {
              senderId: Number(friendId),
              receiverId: userId,
              status: { not: "READ" },
            },
            data: {
              status: "READ",
            },
          });

          if (result.count > 0) {
            const updated = await prisma.message.findMany({
              where: {
                senderId: Number(friendId),
                receiverId: userId,
                status: "READ",
              },
              select: { id: true },
            });

            const senderSocketId = userSocketMap[Number(friendId)];

            if (senderSocketId) {
              updated.forEach(({ id }) => {
                io.to(senderSocketId).emit("messageStatus", {
                  messageId: id,
                  status: "READ",
                });
              });
            }
          }
        } catch (error) {
          console.log("Failed to mark messages as read:", error);
        }
      });

      console.log(`User ${userId} connected with socket ${socket.id}`);

      // Send current online users to everyone
      io.emit(
        "onlineUsers",
        Object.keys(userSocketMap).map(Number)
      );
    });

    socket.on("disconnect", () => {
      for (const mappedUserId in userSocketMap) {
        if (userSocketMap[mappedUserId] === socket.id) {
          delete userSocketMap[mappedUserId];
          break;
        }
      }

      // Send updated online users to everyone
      io.emit(
        "onlineUsers",
        Object.keys(userSocketMap).map(Number)
      );

      console.log("User disconnected:", socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO has not been initialized");
  }

  return io;
};

// Emit an event to every given user that currently has a socket open.
// Safe to call when the socket layer is not running (for example in tests).
export const emitToUsers = (event, payload, userIds = []) => {
  if (!io) return;

  const targets = [...new Set(userIds.map(Number).filter(Number.isFinite))];

  targets.forEach((userId) => {
    const socketId = userSocketMap[userId];

    if (socketId) {
      io.to(socketId).emit(event, payload);
    }
  });
};

export const getReceiverSocketId = (userId) => {
  return userSocketMap[userId];
};
