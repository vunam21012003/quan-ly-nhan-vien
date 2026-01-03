// src/routes/hopDongRoutes.ts
import { Router } from "express";
import multer from "multer";
import * as controller from "../controllers/hopDongController";
import { requireAuth, requireRole } from "../middlewares/auth";
import { layPhamViNguoiDung } from "../utils/pham-vi-nguoi-dung";

const router = Router();
const upload = multer({ dest: "uploads/" });

// Lưu ý: các route GET cụ thể đặt trước '/:id'
router.get("/", requireAuth, controller.list);
router.get("/salary-info/:nhanVienId", requireAuth, controller.getSalaryInfo);
router.get("/phu-cap-loai", requireAuth, controller.getPhuCapLoai);

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

router.post(
  "/",
  requireAuth,
  requireRole(["admin", "manager"]),
  upload.single("file_hop_dong"),
  controller.create
);

router.put(
  "/:id",
  requireAuth,
  requireRole(["admin", "manager"]),
  upload.single("file_hop_dong"),
  controller.update
);

router.delete("/:id", requireAuth, requireRole(["admin"]), controller.remove);

router.get("/:id", requireAuth, controller.detail);

export default router;
