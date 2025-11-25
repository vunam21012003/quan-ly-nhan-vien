// src/routes/hopDongRoutes.ts

import { Router } from "express";
import multer from "multer";
import * as controller from "../controllers/hopDongController";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

// Cấu hình multer để upload file hợp đồng
const upload = multer({ dest: "uploads/" });

/* ==================== DANH SÁCH ==================== */
// Chỉ yêu cầu đăng nhập, quyền chi tiết xử lý trong service
router.get("/", requireAuth, controller.list);
router.get("/:id", requireAuth, controller.detail);

/* ==================== TẠO MỚI ==================== */
// Chỉ Admin hoặc Manager (logic Manager Kế toán kiểm tra thêm trong service)
router.post(
  "/",
  requireAuth,
  requireRole(["admin", "manager"]),
  upload.single("file_hop_dong"),
  controller.create
);

/* ==================== CẬP NHẬT ==================== */
// ❗ PHẢI CÓ upload.single → sửa lỗi req.body = {} khi dùng FormData
router.put(
  "/:id",
  requireAuth,
  requireRole(["admin", "manager"]),
  upload.single("file_hop_dong"),
  controller.update
);

/* ==================== XOÁ ==================== */
// Chỉ Admin được xoá
router.delete("/:id", requireAuth, requireRole(["admin"]), controller.remove);

export default router;
