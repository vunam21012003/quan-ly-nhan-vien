//taiKhoanService.ts
import { Router } from "express";
import * as taiKhoanController from "../controllers/taiKhoanController";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

// Lấy danh sách tài khoản để chọn trưởng phòng
router.get("/for-manager-select", taiKhoanController.getForManagerSelect);

router.get(
  "/",
  requireAuth,
  requireRole(["admin"]), // ❗ chỉ admin được xem danh sách
  taiKhoanController.getAll
);

// ❗ Admin xem bất kỳ tài khoản — Manager & Employee chỉ xem tài khoản của chính mình
router.get("/:id", requireAuth, taiKhoanController.getById);

// ❗ Lấy theo nhân viên — cũng cùng logic như trên
router.get("/by-nhan-vien/:id", requireAuth, taiKhoanController.getByNhanVienId);

// Admin tạo tài khoản
router.post("/", requireAuth, requireRole(["admin"]), taiKhoanController.create);

// Admin cập nhật tài khoản
router.put("/:id", requireAuth, requireRole(["admin"]), taiKhoanController.update);

// Admin xoá
router.delete("/:id", requireAuth, requireRole(["admin"]), taiKhoanController.remove);

// Ai cũng login được
router.post("/login", taiKhoanController.login);

// ⭐ NEW: Manager & Employee tự đổi mật khẩu
router.patch("/:id/mat-khau", requireAuth, taiKhoanController.updatePassword);

export default router;
