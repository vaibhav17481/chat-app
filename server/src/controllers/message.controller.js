import prisma from "../lib/prisma.js";
import { getIO, getReceiverSocketId } from "../sockets/socket.js";

export const sendMessage = async (req, res) => {
  try {
    const { receiverId, content } = req.body;

    if (!receiverId || !content) {
      return res.status(400).json({
        message: "Receiver ID and content are required",
      });
    }

    const receiver = await prisma.user.findUnique({
      where: {
        id: Number(receiverId),
      },
    });

    if (!receiver) {
      return res.status(404).json({
        message: "Receiver not found",
      });
    }

    const friendship = await prisma.friend.findFirst({
      where: {
        OR: [
          {
            user1Id: req.user.userId,
            user2Id: Number(receiverId),
          },
          {
            user1Id: Number(receiverId),
            user2Id: req.user.userId,
          },
        ],
      },
    });

    if (!friendship) {
      return res.status(403).json({
        message: "You can only message your friends",
      });
    }

    const receiverSocketId = getReceiverSocketId(Number(receiverId));

    const message = await prisma.message.create({
      data: {
        senderId: req.user.userId,
        receiverId: Number(receiverId),
        content,
        // If the receiver is online the message is already delivered
        status: receiverSocketId ? "DELIVERED" : "SENT",
      },
    });

    const io = getIO();

    // Let the sender know the delivery status in real time
    const senderSocketId = getReceiverSocketId(req.user.userId);

    if (senderSocketId) {
      io.to(senderSocketId).emit("messageStatus", {
        messageId: message.id,
        status: message.status,
      });
    }

    // Send the new message to the receiver in real time
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", message);
    }

    return res.status(201).json({
      message: "Message sent successfully",
      data: message,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};
export const getConversation = async (req, res) => {
  try {
    const { friendId } = req.params;

    const friendship = await prisma.friend.findFirst({
      where: {
        OR: [
          {
            user1Id: req.user.userId,
            user2Id: Number(friendId),
          },
          {
            user1Id: Number(friendId),
            user2Id: req.user.userId,
          },
        ],
      },
    });

    if (!friendship) {
      return res.status(403).json({
        message: "You are not friends with this user",
      });
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          {
            senderId: req.user.userId,
            receiverId: Number(friendId),
          },
          {
            senderId: Number(friendId),
            receiverId: req.user.userId,
          },
        ],
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return res.status(200).json(messages);
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};
export const getUnreadCounts = async (req, res) => {
  try {
    const grouped = await prisma.message.groupBy({
      by: ["senderId"],
      where: {
        receiverId: req.user.userId,
        status: { not: "READ" },
      },
      _count: {
        _all: true,
      },
    });

    const counts = grouped.map((group) => ({
      friendId: group.senderId,
      count: group._count._all,
    }));

    return res.status(200).json(counts);
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};
export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({
        message: "Message content is required",
      });
    }

    const message = await prisma.message.findUnique({
      where: {
        id: Number(messageId),
      },
    });

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    // Only the sender can edit their own message
    if (message.senderId !== req.user.userId) {
      return res.status(403).json({
        message: "You can only edit your own messages",
      });
    }

    const updatedMessage = await prisma.message.update({
      where: {
        id: Number(messageId),
      },
      data: {
        content: content.trim(),
        edited: true,
      },
    });

    const io = getIO();

    const receiverSocketId = getReceiverSocketId(message.receiverId);

    // Tell receiver that this message was edited
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageEdited", updatedMessage);
    }

    // Tell sender too, so multiple tabs/devices stay synchronized
    const senderSocketId = getReceiverSocketId(message.senderId);

    if (senderSocketId) {
      io.to(senderSocketId).emit("messageEdited", updatedMessage);
    }

    return res.status(200).json({
      message: "Message edited successfully",
      data: updatedMessage,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await prisma.message.findUnique({
      where: {
        id: Number(messageId),
      },
    });

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    // Only the sender can delete their own message
    if (message.senderId !== req.user.userId) {
      return res.status(403).json({
        message: "You can only delete your own messages",
      });
    }

    const deletedMessage = await prisma.message.update({
      where: {
        id: Number(messageId),
      },
      data: {
        content: "This message was deleted",
        deleted: true,
      },
    });

    const io = getIO();

    const receiverSocketId = getReceiverSocketId(message.receiverId);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageDeleted", deletedMessage);
    }

    const senderSocketId = getReceiverSocketId(message.senderId);

    if (senderSocketId) {
      io.to(senderSocketId).emit("messageDeleted", deletedMessage);
    }

    return res.status(200).json({
      message: "Message deleted successfully",
      data: deletedMessage,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};