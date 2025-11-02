import { Router } from "express";
import * as controller from "../controllers/phanCongLamBuController";

const router = Router();

// Lấy danh sách nhân viên được phân công theo ngày
router.get("/:ngay", controller.getByDate);

// Lưu danh sách nhân viên được phân công
router.post("/", controller.saveForDate);

export default router;
