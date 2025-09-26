import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import * as controller from "../controllers/nhanVienController";

const router = Router();

/**
 * Danh sách nhân viên
 * Chỉ admin/manager được list tất cả
 */
router.get("/", requireAuth, requireRole(["admin", "manager"]), controller.getAll);

/**
 * Chi tiết theo ID
 * Cho phép admin/manager/employee xem (quyền hạn chi tiết xử lý ở controller/service nếu cần)
 */
router.get("/:id", requireAuth, requireRole(["admin", "manager", "employee"]), controller.getById);

/**
 * Tạo mới nhân viên
 * Chỉ admin
 */
router.post("/", requireAuth, requireRole(["admin"]), controller.create);

/**
 * Cập nhật toàn phần
 * Chỉ admin
 */
router.put("/:id", requireAuth, requireRole(["admin"]), controller.update);

/**
 * Cập nhật một phần (partial)
 * Chỉ admin
 */
router.patch("/:id", requireAuth, requireRole(["admin"]), controller.partialUpdate);

/**
 * Xoá nhân viên
 * Chỉ admin
 */
router.delete("/:id", requireAuth, requireRole(["admin"]), controller.remove);

export default router;
