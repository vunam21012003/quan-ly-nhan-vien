// src/routes/lichSuTraLuongRoutes.ts
import { Router } from "express";
import * as controller from "../controllers/lichSuTraLuongController";
import { requireAuth, requireRole, requireKetoanOrAdmin } from "../middlewares/auth";

const router = Router();

/*  
  XEM LỊCH SỬ TRẢ LƯƠNG (admin + kế toán)
*/
router.get(
  "/",
  requireAuth,
  requireRole(["admin", "manager", "employee"]),
  requireKetoanOrAdmin,
  controller.list
);

/*
  TẠO LỊCH SỬ TRẢ LƯƠNG (admin + kế toán)
*/
router.post(
  "/",
  requireAuth,
  requireRole(["admin", "manager"]),
  requireKetoanOrAdmin,
  controller.create
);

/*
  CẬP NHẬT LỊCH SỬ TRẢ LƯƠNG (chỉ admin)
*/
router.put("/:id", requireAuth, requireRole(["admin"]), controller.update);

/*
  XOÁ LỊCH SỬ TRẢ LƯƠNG (chỉ admin)
*/
router.delete("/:id", requireAuth, requireRole(["admin"]), controller.remove);

export default router;
