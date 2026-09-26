import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getProfile,
  getAllUsers,
  searchUsers,
  getUserById,
} from "../controllers/user.controller.js";

const router = express.Router();

router.get("/profile", protectRoute, getProfile);

router.get("/", protectRoute, getAllUsers);
router.get("/search", protectRoute, searchUsers);
router.get("/:id", protectRoute, getUserById);

export default router;