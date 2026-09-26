import prisma from "../lib/prisma.js";

export const sendFriendRequest = async (req, res) => {
  try {
    const { receiverId } = req.body;

    // 1. Validate input
    if (!receiverId) {
      return res.status(400).json({
        message: "Receiver ID is required",
      });
    }

    // 2. Cannot send request to yourself
    if (Number(receiverId) === req.user.userId) {
      return res.status(400).json({
        message: "You cannot send a friend request to yourself",
      });
    }

    // 3. Check if receiver exists
    const receiver = await prisma.user.findUnique({
      where: {
        id: receiverId,
      },
    });

    if (!receiver) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // 4. Check if request already exists (same direction)
    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        senderId: req.user.userId,
        receiverId,
      },
    });

    if (existingRequest) {
      return res.status(400).json({
        message: "Friend request already sent",
      });
    }

    // 5. Check reverse request
    const reverseRequest = await prisma.friendRequest.findFirst({
      where: {
        senderId: receiverId,
        receiverId: req.user.userId,
      },
    });

    if (reverseRequest) {
      return res.status(400).json({
        message: "This user has already sent you a friend request",
      });
    }

    // 6. Create request
    const friendRequest = await prisma.friendRequest.create({
      data: {
        senderId: req.user.userId,
        receiverId,
      },
    });

    return res.status(201).json({
      message: "Friend request sent successfully",
      friendRequest,
    });

  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};
// Get incominng request

export const getIncomingRequests = async (req, res) => {
  try {
    const requests = await prisma.friendRequest.findMany({
      where: {
        receiverId: req.user.userId,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    return res.json(requests);

  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

// Get outgoing request 

export const getOutgoingRequests = async (req, res) => {
  try {
    const requests = await prisma.friendRequest.findMany({
      where: {
        senderId: req.user.userId,
      },
      include: {
        receiver: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    return res.json(requests);

  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};
// Acceptfriendrequest

export const acceptFriendRequest = async (req, res) => {
  try {

    const { id } = req.params;

    const request = await prisma.friendRequest.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!request) {
      return res.status(404).json({
        message: "Friend request not found",
      });
    }

    if (request.receiverId !== req.user.userId) {
      return res.status(403).json({
        message: "Unauthorized",
      });
    }

    await prisma.friend.create({
      data: {
        user1Id: request.senderId,
        user2Id: request.receiverId,
      },
    });

    await prisma.friendRequest.delete({
      where: {
        id: request.id,
      },
    });

    return res.json({
      message: "Friend request accepted",
    });

  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

// rejectFriendRequest

export const rejectFriendRequest = async (req, res) => {
  try {

    const { id } = req.params;

    const request = await prisma.friendRequest.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!request) {
      return res.status(404).json({
        message: "Friend request not found",
      });
    }

    if (request.receiverId !== req.user.userId) {
      return res.status(403).json({
        message: "Unauthorized",
      });
    }

    await prisma.friendRequest.delete({
      where: {
        id: request.id,
      },
    });

    return res.json({
      message: "Friend request rejected",
    });

  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

//  Getting friends

export const getFriends = async (req, res) => {
  try {

    const friends = await prisma.friend.findMany({
      where: {
        OR: [
          {
            user1Id: req.user.userId,
          },
          {
            user2Id: req.user.userId,
          },
        ],
      },
      include: {
        user1: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        user2: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    return res.json(friends);

  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};
