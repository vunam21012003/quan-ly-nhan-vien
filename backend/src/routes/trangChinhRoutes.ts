// src/routes/trangChinhRoutes.ts
import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { getComplete } from "../controllers/trangChinhController";

const router = Router();

// FE gọi: GET /api/trang-chinh/complete
router.get("/complete", requireAuth, requireRole(["admin", "manager", "employee"]), getComplete);

export default router;
