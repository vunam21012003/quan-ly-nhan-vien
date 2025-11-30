import { Router } from "express";
import multer from "multer";
import * as controller from "../controllers/hopDongController";
import { requireAuth, requireRole } from "../middlewares/auth";
import { layPhamViNguoiDung } from "../utils/pham-vi-nguoi-dung";

const router = Router();
const upload = multer({ dest: "uploads/" });

/* ==================== DANH SÁCH ==================== */
router.get("/", requireAuth, controller.list);
router.get("/:id", requireAuth, controller.detail);

/* ==================== QUYỀN HỢP ĐỒNG (CHO FE) ==================== */
router.get(
  "/_permissions/me",
  requireAuth,
  requireRole(["admin", "manager", "employee"]),
  async (req, res, next) => {
    try {
      const phamvi = await layPhamViNguoiDung(req);
      res.json({
        role: phamvi.role,
        isAccountingManager: !!phamvi.isAccountingManager,
      });
    } catch (e) {
      next(e);
    }
  }
);

/* ==================== TẠO MỚI ==================== */
router.post(
  "/",
  requireAuth,
  requireRole(["admin", "manager"]),
  upload.single("file_hop_dong"),
  controller.create
);

/* ==================== CẬP NHẬT ==================== */
router.put(
  "/:id",
  requireAuth,
  requireRole(["admin", "manager"]),
  upload.single("file_hop_dong"),
  controller.update
);

/* ==================== XOÁ ==================== */
router.delete("/:id", requireAuth, requireRole(["admin"]), controller.remove);

export default router;
