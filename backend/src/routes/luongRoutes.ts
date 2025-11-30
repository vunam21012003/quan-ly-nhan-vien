// src/routes/luongRoutes.ts
import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import * as controller from "../controllers/luongController";
import { requireKetoanOrAdmin } from "../middlewares/auth";

const router = Router();

// ======== LƯƠNG ========

// Xem danh sách lương → admin + manager (thường hoặc kế toán)
router.get("/", requireAuth, requireRole(["admin", "manager"]), controller.getAll);

// Xem lương cá nhân
router.get("/me", requireAuth, requireRole(["admin", "manager", "employee"]), controller.getMine);

// Chi tiết 1 bản lương
router.get("/:id", requireAuth, requireRole(["admin", "manager", "employee"]), controller.getById);

// Tạo – chỉ admin (hệ thống tính tự động, trường hợp đặc biệt)
router.post("/", requireAuth, requireRole(["admin"]), controller.create);

// Sửa – chỉ admin
router.put("/:id", requireAuth, requireRole(["admin"]), controller.update);

// Xóa – chỉ admin
router.delete("/:id", requireAuth, requireRole(["admin"]), controller.remove);

// ⭐ Tính lương tháng (Admin + Manager kế toán)
router.post("/tinh-thang", requireAuth, requireKetoanOrAdmin, controller.calcSalary);

// ⭐ Duyệt / Hủy duyệt lương tháng (Admin + Manager kế toán)
router.post("/toggle-duyet", requireAuth, requireKetoanOrAdmin, controller.toggleDuyet);

export default router;
