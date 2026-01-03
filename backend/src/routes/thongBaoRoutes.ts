// src/routes/thongBaoRoutes.ts
import { Router } from "express";
import * as thongBaoController from "../controllers/thongBaoController";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

// Lấy thông báo theo người
router.get("/:id", requireAuth, thongBaoController.layTheoNguoi);

// Tạo thông báo - chỉ admin + manager
router.post("/", requireAuth, requireRole(["admin", "manager"]), thongBaoController.tao);

// Đánh dấu đã đọc
router.put("/doc/:id", requireAuth, thongBaoController.danhDauDaDoc);

// Xóa thông báo - chỉ admin
router.delete("/:id", requireAuth, requireRole(["admin"]), thongBaoController.xoa);

export default router;
