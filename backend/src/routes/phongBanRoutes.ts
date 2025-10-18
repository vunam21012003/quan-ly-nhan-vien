import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import * as controller from "../controllers/phongBanController";

const router = Router();

// Chỉ Admin được phép thêm/sửa/xoá
router.get("/", requireAuth, requireRole(["admin"]), controller.getAll);
router.post("/", requireAuth, requireRole(["admin"]), controller.create);
router.put("/:id", requireAuth, requireRole(["admin"]), controller.update);
router.delete("/:id", requireAuth, requireRole(["admin"]), controller.remove);

export default router;
