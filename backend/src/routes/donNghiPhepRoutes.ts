import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import * as controller from "../controllers/donNghiPhepController";

const router = Router();

// Gửi đơn (Tất cả nhân viên)
router.post("/", requireAuth, requireRole(["admin", "manager", "employee"]), controller.create);

// Xem danh sách (Tự lọc theo quyền bên trong service)
router.get("/", requireAuth, requireRole(["admin", "manager", "employee"]), controller.getAll);

// Duyệt đơn (Chỉ Admin/Manager)
router.post("/:id/approve", requireAuth, requireRole(["admin", "manager"]), controller.approve);

// Từ chối đơn (Chỉ Admin/Manager)
router.post("/:id/reject", requireAuth, requireRole(["admin", "manager"]), controller.reject);

// Hủy đơn (Nhân viên tự hủy)
router.post(
  "/:id/cancel",
  requireAuth,
  requireRole(["admin", "manager", "employee"]),
  controller.cancel
);

export default router;
