import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";

import {
  sendMessage,
  getConversation,
  getUnreadCounts,
  editMessage,
  deleteMessage,
  toggleReaction,
  getMessageReactions,
} from "../controllers/message.controller.js";

const router = express.Router();

router.post("/", protectRoute, sendMessage);

router.get("/unread-counts", protectRoute, getUnreadCounts);

router.get("/:messageId/reactions", protectRoute, getMessageReactions);

router.post("/:messageId/reactions", protectRoute, toggleReaction);

router.put("/:messageId", protectRoute, editMessage);

router.delete("/:messageId", protectRoute, deleteMessage);

router.get("/:friendId", protectRoute, getConversation);

export default router;
