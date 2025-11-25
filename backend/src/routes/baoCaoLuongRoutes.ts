import { Router } from "express";
import * as controller from "../controllers/baoCaoLuongController";
import { requireAuth, requireRole, requireKetoanOrAdmin } from "../middlewares/auth";

const router = Router();

router.get(
  "/luong",
  requireAuth,
  requireRole(["admin", "manager"]), // Bắt buộc là admin hoặc manager
  requireKetoanOrAdmin, // Và nếu là manager thì phải là manager phòng Kế toán
  controller.getBaoCaoLuong
);

router.get(
  "/luong/lich-su/:nhan_vien_id",
  requireAuth,
  requireRole(["admin", "manager"]),
  requireKetoanOrAdmin,
  controller.getLichSuTraLuong
);

router.get(
  "/luong/chi-tiet/:nhan_vien_id",
  requireAuth,
  requireRole(["admin", "manager"]),
  requireKetoanOrAdmin,
  controller.getChiTietLuongNhanVien
);

router.get(
  "/luong/export",
  requireAuth,
  requireRole(["admin", "manager"]),
  requireKetoanOrAdmin,
  controller.exportExcel
);

export default router;
