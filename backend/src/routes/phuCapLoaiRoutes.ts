import { Router } from "express";
import * as controller from "../controllers/phuCapLoaiController";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

// Admin + Manager được xem & quản lý
router.get("/", requireAuth, requireRole(["admin", "manager"]), controller.list);
router.post("/", requireAuth, requireRole(["admin"]), controller.create);
router.put("/:id", requireAuth, requireRole(["admin"]), controller.update);
router.delete("/:id", requireAuth, requireRole(["admin"]), controller.remove);

export default router;
