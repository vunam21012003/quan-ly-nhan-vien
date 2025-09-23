import { Router } from "express";
import * as controller from "../controllers/baoCaoLuongController";

const router = Router();

router.get("/luong", controller.getBaoCaoLuong);
router.get("/luong/chi-tiet/:nhan_vien_id", controller.getChiTietLuongNhanVien);

export default router;
