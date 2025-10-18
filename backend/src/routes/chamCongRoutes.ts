import { Router } from "express";
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
router.delete("/:id", requireAuth, requireRole(["admin"]), chamCongController.remove);

// 👉 Route mới: upload Excel
router.post(
  "/import-excel",
  requireAuth,
  requireRole(["admin", "manager"]),
  upload.single("file"),
  chamCongController.importExcel
);

export default router;
