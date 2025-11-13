import { Router } from "express";
import * as controller from "../controllers/baoCaoLuongController";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

router.get("/luong", requireAuth, requireRole(["admin", "manager"]), controller.getBaoCaoLuong);
router.get("/luong/chi-tiet/:nhan_vien_id", controller.getChiTietLuongNhanVien);
router.get("/luong/export", requireAuth, requireRole(["admin", "manager"]), controller.exportExcel);

export default router;
