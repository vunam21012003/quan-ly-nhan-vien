import { Router } from "express";
import * as taiKhoanController from "../controllers/taiKhoanController";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

// Xem danh sách: Admin, Manager
router.get("/", requireAuth, requireRole(["admin", "manager"]), taiKhoanController.getAll);
router.get("/:id", requireAuth, requireRole(["admin", "manager"]), taiKhoanController.getById);

// Thêm, Sửa, Xóa: CHỈ Admin
router.post("/", requireAuth, requireRole(["admin"]), taiKhoanController.create);
router.put("/:id", requireAuth, requireRole(["admin"]), taiKhoanController.update);
router.delete("/:id", requireAuth, requireRole(["admin"]), taiKhoanController.remove);

router.post("/login", taiKhoanController.login);

export default router;
