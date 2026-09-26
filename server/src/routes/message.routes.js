import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";

import {
  sendMessage,
  getConversation,
  getUnreadCounts,
  editMessage,
  deleteMessage,
} from "../controllers/message.controller.js";

const router = express.Router();

router.post("/", protectRoute, sendMessage);

router.get("/unread-counts", protectRoute, getUnreadCounts);

router.put("/:messageId", protectRoute, editMessage);

router.delete("/:messageId", protectRoute, deleteMessage);

router.get("/:friendId", protectRoute, getConversation);

export default router;
