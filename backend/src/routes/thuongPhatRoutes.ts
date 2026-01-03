// thưởng phạt routes
import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import * as controller from "../controllers/thuongPhatController";

const router = Router();

router.get("/export-excel", requireAuth, requireRole(["admin", "manager"]), controller.exportExcel);
router.get("/", requireAuth, requireRole(["admin", "manager", "employee"]), controller.list);
router.get("/:id", requireAuth, requireRole(["admin", "manager", "employee"]), controller.detail);
router.post("/", requireAuth, requireRole(["admin", "manager"]), controller.create);
router.put("/:id", requireAuth, requireRole(["admin", "manager"]), controller.update);
router.delete(
  "/:id",
  requireAuth,
  requireRole(["admin", "manager", "employee"]), // cho phép vào, service tự chặn
  controller.remove
);

export default router;
