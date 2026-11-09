import prisma from "../lib/prisma.js";
import { emitToUsers, getReceiverSocketId } from "../sockets/socket.js";
import {
  MESSAGE_RELATIONS,
  getReactions,
  isParticipant,
  notifyParticipants,
} from "../services/message.service.js";

const EMOJI_MAX_LENGTH = 16;
const EMOJI_PATTERN = /\p{Extended_Pictographic}/u;

export const sendMessage = async (req, res) => {
  try {
    const { receiverId, content, replyToId } = req.body;

    if (!receiverId) {
      return res.status(400).json({
        message: "Receiver ID is required",
      });
    }

    if (!content?.trim()) {
      return res.status(400).json({
        message: "Message content is required",
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

    // A reply may only point at a message of the very same conversation.
    let replyTarget = null;

    if (replyToId !== undefined && replyToId !== null && replyToId !== "") {
      const replyToIdNumber = Number(replyToId);

      if (!Number.isInteger(replyToIdNumber)) {
        return res.status(400).json({
          message: "Invalid reply target",
        });
      }

      const target = await prisma.message.findUnique({
        where: { id: replyToIdNumber },
      });

      if (!target) {
        return res.status(404).json({
          message: "The message you are replying to no longer exists",
        });
      }

      const sameConversation =
        (target.senderId === req.user.userId &&
          target.receiverId === Number(receiverId)) ||
        (target.receiverId === req.user.userId &&
          target.senderId === Number(receiverId));

      if (!sameConversation) {
        return res.status(403).json({
          message: "You can only reply to messages in this conversation",
        });
      }

      if (target.deleted) {
        return res.status(400).json({
          message: "The message you are replying to was deleted",
        });
      }

      replyTarget = target;
    }

    const receiverSocketId = getReceiverSocketId(Number(receiverId));

    const message = await prisma.message.create({
      data: {
        senderId: req.user.userId,
        receiverId: Number(receiverId),
        content: content.trim(),
        replyToId: replyTarget ? replyTarget.id : null,
        // If the receiver is online the message is already delivered
        status: receiverSocketId ? "DELIVERED" : "SENT",
      },
      include: MESSAGE_RELATIONS,
    });

    // Let the sender know the delivery status in real time
    emitToUsers("messageStatus", {
      messageId: message.id,
      status: message.status,
    }, [req.user.userId]);

    // Send the new message to the receiver in real time
    emitToUsers("newMessage", message, [Number(receiverId)]);

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
      include: MESSAGE_RELATIONS,
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
      include: MESSAGE_RELATIONS,
    });

    // Tell both sides that this message was edited
    notifyParticipants("messageEdited", updatedMessage, message);

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
      include: MESSAGE_RELATIONS,
    });

    // Reactions on a deleted message make no sense anymore
    await prisma.reaction.deleteMany({
      where: {
        messageId: Number(messageId),
      },
    });

    const clearedMessage = {
      ...deletedMessage,
      reactions: [],
    };

    // Tell both sides that this message was deleted
    notifyParticipants("messageDeleted", clearedMessage, message);

    return res.status(200).json({
      message: "Message deleted successfully",
      data: clearedMessage,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

// Add, change or remove the reaction of the current user on a message.
export const toggleReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    const messageIdNumber = Number(messageId);

    if (!Number.isInteger(messageIdNumber)) {
      return res.status(400).json({
        message: "Invalid message id",
      });
    }

    const emojiValue = typeof emoji === "string" ? emoji.trim() : "";

    if (!emojiValue) {
      return res.status(400).json({
        message: "Emoji is required",
      });
    }

    if (emojiValue.length > EMOJI_MAX_LENGTH) {
      return res.status(400).json({
        message: "Invalid emoji",
      });
    }

    if (!EMOJI_PATTERN.test(emojiValue)) {
      return res.status(400).json({
        message: "Invalid emoji",
      });
    }

    const message = await prisma.message.findUnique({
      where: { id: messageIdNumber },
    });

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    // Reactions are only allowed on messages of your own conversations
    if (!isParticipant(message, req.user.userId)) {
      return res.status(403).json({
        message: "You can only react to messages in your conversations",
      });
    }

    const existing = await prisma.reaction.findMany({
      where: {
        messageId: message.id,
        userId: req.user.userId,
      },
    });

    const sameEmoji = existing.find((reaction) => reaction.emoji === emojiValue);

    if (sameEmoji) {
      // Same emoji again removes the reaction
      await prisma.reaction.delete({
        where: { id: sameEmoji.id },
      });
    } else {
      // A different emoji replaces the previous reaction, so a user always
      // has at most one reaction per message and never the same one twice.
      await prisma.reaction.deleteMany({
        where: {
          messageId: message.id,
          userId: req.user.userId,
        },
      });

      await prisma.reaction.create({
        data: {
          messageId: message.id,
          userId: req.user.userId,
          emoji: emojiValue,
        },
      });
    }

    const reactions = await getReactions(message.id);

    // Both sides see the new reaction state in real time
    notifyParticipants(
      "messageReaction",
      { messageId: message.id, reactions },
      message
    );

    return res.status(200).json({
      message: sameEmoji ? "Reaction removed" : "Reaction updated",
      data: {
        messageId: message.id,
        reactions,
        mine: sameEmoji ? null : emojiValue,
      },
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

// The full message including its reply target and reactions.
export const getMessageReactions = async (req, res) => {
  try {
    const { messageId } = req.params;

    const messageIdNumber = Number(messageId);

    if (!Number.isInteger(messageIdNumber)) {
      return res.status(400).json({
        message: "Invalid message id",
      });
    }

    const message = await prisma.message.findUnique({
      where: { id: messageIdNumber },
    });

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    if (!isParticipant(message, req.user.userId)) {
      return res.status(403).json({
        message: "You can only view messages in your conversations",
      });
    }

    const reactions = await getReactions(message.id);

    return res.status(200).json({
      data: {
        messageId: message.id,
        reactions,
      },
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};