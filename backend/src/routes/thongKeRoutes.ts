import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import * as controller from "../controllers/thongKeController";

const router = Router();

// 1. Thống kê chung cho Admin/Manager
router.get(
  "/dashboard",
  requireAuth,
  requireRole(["admin", "manager"]),
  controller.getAdminManagerStats
);

// 2. Thống kê cá nhân cho Employee
router.get(
  "/user-info",
  requireAuth,
  requireRole(["employee", "manager", "admin"]),
  controller.getEmployeeStats
);

export default router;
