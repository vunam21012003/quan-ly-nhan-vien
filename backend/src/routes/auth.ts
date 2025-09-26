import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import * as authController from "../controllers/authController";
import { loginRateLimiter } from "../middlewares/rateLimit";

const router = Router();

router.post("/register", authController.register);
router.post("/login", loginRateLimiter, authController.login);
router.post("/change-password", requireAuth, authController.changePassword);
router.get("/me", requireAuth, authController.me);

export default router;
