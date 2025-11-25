import { Router } from "express";
import { pool } from "../db";
import multer from "multer";
import { requireAuth, requireRole } from "../middlewares/auth";
import * as chamCongController from "../controllers/chamCongController";

const router = Router();

// Cấu hình upload file
const upload = multer({ dest: "uploads/" });

router.get(
  "/",
  requireAuth,
  requireRole(["admin", "manager", "employee"]),
  chamCongController.list
);
router.post("/", requireAuth, requireRole(["admin", "manager"]), chamCongController.create);
router.put("/:id", requireAuth, requireRole(["admin"]), chamCongController.update);
router.delete(
  "/:id",
  requireAuth,
  requireRole(["admin", "manager", "employee"]), // để controller tự xử lý phân quyền chi tiết
  chamCongController.remove
);

// 👉 Route mới: upload Excel
router.post(
  "/import-excel",
  requireAuth,
  requireRole(["admin", "manager"]),
  upload.single("file"),
  chamCongController.importExcel
);
// Route xuất Excel
router.get(
  "/export",
  requireAuth,
  requireRole(["admin", "manager"]),
  chamCongController.exportExcel
);

// ✅ Thêm dòng này cho import Excel
router.post(
  "/import-excel",
  requireAuth,
  requireRole(["admin", "manager"]),
  upload.single("file"), // 👈 middleware multer xử lý file upload
  chamCongController.importExcel
);

// ✅ Xuất Excel
router.get(
  "/export",
  requireAuth,
  requireRole(["admin", "manager"]),
  chamCongController.exportExcel
);

// ================== API PHỤ: PHÒNG BAN ==================
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

export default router;
