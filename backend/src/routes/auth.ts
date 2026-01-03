//auth.ts
import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import * as authController from "../controllers/authController";
import { loginRateLimiter } from "../middlewares/rateLimit";

const router = Router();

router.post("/register", authController.register);
router.post("/login", loginRateLimiter, authController.login);
router.post("/change-password", requireAuth, authController.changePassword);

router.post("/forgot-password", authController.forgotPassword);

router.get("/me", requireAuth, authController.me);

router.get("/check-permissions", requireAuth, authController.checkPermissions);
export default router;
