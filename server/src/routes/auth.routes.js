import express from "express";
import {
  register,
  login,
  verifyEmail,
} from "../controllers/auth.controller.js";


const router = express.Router();


router.post("/verify-email", verifyEmail);
router.post("/register", register);
router.post("/login", login);

export default router;