import express from "express";
import {
  register,
  login,
  refreshSession,
  logout,
  verifyEmail,
  resendVerificationCode,
} from "../controllers/auth.controller.js";
import {
  loginLimiter,
  refreshLimiter,
  registerLimiter,
  resendLimiter,
  verifyLimiter,
} from "../middleware/rateLimit.middleware.js";

const router = express.Router();

router.post("/verify-email", verifyLimiter, verifyEmail);
router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.post("/resend-verification", resendLimiter, resendVerificationCode);
router.post("/refresh", refreshLimiter, refreshSession);
router.post("/logout", logout);

export default router;
