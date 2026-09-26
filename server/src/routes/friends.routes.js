import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";

import {
  sendFriendRequest,
  getIncomingRequests,
  getOutgoingRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriends,
} from "../controllers/friends.controller.js";

const router = express.Router();

router.post("/request", protectRoute, sendFriendRequest);

router.get("/incoming", protectRoute, getIncomingRequests);

router.get("/outgoing", protectRoute, getOutgoingRequests);

router.post("/accept/:id", protectRoute, acceptFriendRequest);

router.delete("/reject/:id", protectRoute, rejectFriendRequest);

router.get("/", protectRoute, getFriends);

export default router;