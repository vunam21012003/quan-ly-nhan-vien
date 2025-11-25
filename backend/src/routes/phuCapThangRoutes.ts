// routes
import { Router } from "express";
import * as controller from "../controllers/phuCapThangController";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

// Admin + Manager xem, Admin sửa
router.get("/", requireAuth, requireRole(["admin", "manager"]), controller.list);
router.post("/", requireAuth, requireRole(["admin"]), controller.create);
router.put("/:id", requireAuth, requireRole(["admin"]), controller.update);
router.delete("/:id", requireAuth, requireRole(["admin"]), controller.remove);

// Auto copy từ tháng trước
router.post("/auto-copy", requireAuth, requireRole(["admin"]), controller.autoCopy);

export default router;
