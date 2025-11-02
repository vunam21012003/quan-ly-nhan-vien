// src/routes/hopDongRoutes.ts
import { Router } from "express";
import multer from "multer";
import * as controller from "../controllers/hopDongController";

const router = Router();

// 🔹 Cấu hình multer để lưu file upload
const upload = multer({ dest: "uploads/" });

// ==================== DANH SÁCH ====================
router.get("/", controller.list);
router.get("/:id", controller.detail);

// ==================== THÊM / SỬA ====================
router.post("/", upload.single("file_hop_dong"), controller.create);
router.put("/:id", upload.single("file_hop_dong"), controller.update);

// ==================== XOÁ ====================
router.delete("/:id", controller.remove);

export default router;
