import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import * as controller from "../controllers/nhanVienController";

const router = Router();

// Xem danh sách: mọi role đều có thể gọi, nhưng service sẽ tự filter theo phạm vi
router.get("/", requireAuth, requireRole(["admin", "manager", "employee"]), controller.list);

// xuất file excel
router.get(
  "/export",
  requireAuth,
  requireRole(["admin", "manager", "employee"]),
  controller.exportExcel
);

// Xem chi tiết: mọi role (service sẽ kiểm tra phạm vi)
router.get("/:id", requireAuth, requireRole(["admin", "manager", "employee"]), controller.getById);

// xem thông tin hợp đồng, phụ cấp, thưởng phạt
router.get("/:id/overview", requireAuth, controller.getOverview);

// Tạo: admin hoặc manager Kế Toán (service kiểm tra bổ sung)
router.post("/", requireAuth, requireRole(["admin", "manager"]), controller.create);

// Sửa: admin hoặc manager Kế Toán
router.put("/:id", requireAuth, requireRole(["admin", "manager", "employee"]), controller.update);

// Xoá: admin hoặc manager Kế Toán
router.delete("/:id", requireAuth, requireRole(["admin", "manager"]), controller.remove);

// Phục vụ trang Chức vụ: lấy NV theo chuc_vu_id
router.get("/by-chucvu/:chuc_vu_id", requireAuth, requireRole(["admin"]), controller.getByChucVu);

router.patch(
  "/:id/nguoi-phu-thuoc",
  requireAuth,
  requireRole(["admin", "manager"]),
  controller.updateNguoiPhuThuoc
);

export default router;
