//baoCaoLuongRoutes
import { Router } from "express";
import * as controller from "../controllers/baoCaoLuongController";
import { requireAuth, requireRole, requireKetoanOrAdmin } from "../middlewares/auth";
import { layPhamViNguoiDung } from "../utils/pham-vi-nguoi-dung";

const router = Router();

router.get(
  "/luong",
  requireAuth,
  async (req, res, next) => {
    try {
      // Gán phạm vi cho req để service dùng
      req.phamvi = await layPhamViNguoiDung(req);
      next();
    } catch (e) {
      console.error("Lỗi layPhamViNguoiDung:", e);
      return res.status(500).json({ error: "Lỗi xác định phạm vi người dùng" });
    }
  },
  controller.getBaoCaoLuong
);

router.get(
  "/luong/lich-su/:nhan_vien_id",
  requireAuth,
  async (req, res, next) => {
    try {
      req.phamvi = await layPhamViNguoiDung(req);
      next();
    } catch (e) {
      console.error("Lỗi layPhamViNguoiDung:", e);
      return res.status(500).json({ error: "Lỗi xác định phạm vi người dùng" });
    }
  },
  controller.getLichSuTraLuong
);

router.get(
  "/luong/chi-tiet/:nhan_vien_id",
  requireAuth,
  async (req, res, next) => {
    try {
      req.phamvi = await layPhamViNguoiDung(req);
      next();
    } catch (e) {
      console.error("Lỗi layPhamViNguoiDung:", e);
      return res.status(500).json({ error: "Lỗi xác định phạm vi người dùng" });
    }
  },
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
