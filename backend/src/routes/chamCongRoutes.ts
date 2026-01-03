// chamCongRoutes
import { Router } from "express";
import { pool } from "../db";
import multer from "multer";
import { requireAuth, requireRole } from "../middlewares/auth";
import * as chamCongController from "../controllers/chamCongController";

const router = Router();

// Cấu hình upload file
const upload = multer({ dest: "uploads/" });

// ================== CÁC ROUTE CHÍNH ==================
// Lấy danh sách
router.get(
  "/",
  requireAuth,
  requireRole(["admin", "manager", "employee"]),
  chamCongController.list
);
// Tạo mới
router.post("/", requireAuth, requireRole(["admin", "manager"]), chamCongController.create);
// Cập nhật
router.put("/:id", requireAuth, requireRole(["admin", "manager"]), chamCongController.update);
// Xóa
router.delete("/:id", requireAuth, requireRole(["admin", "manager"]), chamCongController.remove);

// ================== ROUTE EXCEL ==================
router.post(
  "/import-excel",
  requireAuth,
  requireRole(["admin", "manager"]),
  upload.single("file"),
  chamCongController.importExcel
);

router.get(
  "/export",
  requireAuth,
  requireRole(["admin", "manager"]),
  chamCongController.exportExcel
);

// ================== API PHỤ: PHÒNG BAN (GIỮ NGUYÊN) ==================
router.get(
  "/phong-ban/list",
  requireAuth,
  requireRole(["admin", "manager", "employee"]),
  async (req, res) => {
    try {
      const [rows]: any = await pool.query(
        "SELECT id, ten_phong_ban FROM phong_ban ORDER BY ten_phong_ban ASC"
      );
      res.json({ items: rows });
    } catch (err) {
      console.error("GET /cham-cong/phong-ban/list error:", err);
      res.status(500).json({ message: "Lỗi khi lấy danh sách phòng ban" });
    }
  }
);

// ================== ROUTE XỬ LÝ TỰ ĐỘNG ==================
router.post("/auto-process", requireAuth, requireRole(["admin"]), chamCongController.autoProcess);

export default router;
