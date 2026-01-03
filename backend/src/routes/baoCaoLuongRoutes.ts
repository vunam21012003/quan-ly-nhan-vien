// src/routes/baoCaoLuongRoutes.ts
import { Router } from "express";
import * as controller from "../controllers/baoCaoLuongController";
import { requireAuth, requireKetoanOrAdmin } from "../middlewares/auth";
import { layPhamViNguoiDung } from "../utils/pham-vi-nguoi-dung";

const router = Router();

// API LẤY BÁO CÁO LƯƠNG
router.get(
  "/luong",
  requireAuth,
  async (req, res, next) => {
    try {
      req.phamvi = await layPhamViNguoiDung(req);
      next();
    } catch (e) {
      console.error("Lỗi layPhamViNguoiDung:", e);
      req.phamvi = {
        employeeId: (req.user as any)?.nhan_vien_id || null,
        managedDepartmentIds: [],
        role: "employee",
        isAccountingManager: false,
      };
      next();
    }
  },
  controller.getBaoCaoLuong
);

router.get(
  "/luong/chi-tiet/:nhan_vien_id",
  requireAuth,
  async (req, res, next) => {
    try {
      req.phamvi = await layPhamViNguoiDung(req);
      next();
    } catch (e) {
      next();
    }
  },
  controller.getChiTietLuongNhanVien
);

router.get(
  "/luong/lich-su/:nhan_vien_id",
  requireAuth,
  async (req, res, next) => {
    try {
      req.phamvi = await layPhamViNguoiDung(req);
      next();
    } catch (e) {
      next();
    }
  },
  controller.getLichSuTraLuong
);

router.get("/luong/export", requireAuth, requireKetoanOrAdmin, controller.exportExcel);

export default router;
