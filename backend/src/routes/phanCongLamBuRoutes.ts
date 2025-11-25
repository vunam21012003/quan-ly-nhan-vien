//phanCongLamBuRoutes.ts
import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth"; // 💡 Cần import 2 hàm này
import * as controller from "../controllers/phanCongLamBuController";

const router = Router();

// 1. ROUTE MỚI ĐƯỢC ƯU TIÊN: Lấy danh sách nhân viên cho chức năng phân công.
// 💡 Đặt TRƯỚC /:ngay để tránh lỗi "Incorrect DATE value".
router.get(
  "/nhan-vien-cho-phan-cong",
  requireAuth,
  requireRole(["admin", "manager"]),
  controller.getNhanVienChoPhanCongController
);

// 2. Lấy danh sách nhân viên được phân công theo ngày
router.get("/:ngay", requireAuth, requireRole(["admin", "manager"]), controller.getByDate);

// 3. Lưu danh sách nhân viên được phân công
router.post("/", requireAuth, requireRole(["admin", "manager"]), controller.saveForDate);

export default router;
