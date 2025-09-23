import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import * as authController from "../controllers/authController";

const router = Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/change-password", requireAuth, authController.changePassword);
router.get("/me", requireAuth, authController.me);

export default router;
