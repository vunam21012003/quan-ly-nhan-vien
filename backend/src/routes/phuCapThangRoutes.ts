// phuCapThangRoutes
import { Router } from "express";
import * as controller from "../controllers/phuCapThangController";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

// Admin + Manager xem, Admin sửa
// GET → admin + manager + employee
router.get("/", requireAuth, requireRole(["admin", "manager", "employee"]), controller.list);

// POST → admin + manager thường
router.post(
  "/",
  requireAuth,
  requireRole(["admin", "manager"]), // manager kế toán cũng vào đây nhưng FE sẽ ẩn nút
  controller.create
);

// PUT → admin + manager kế toán
router.put("/:id", requireAuth, requireRole(["admin", "manager"]), controller.update);

// DELETE → admin + manager kế toán
router.delete("/:id", requireAuth, requireRole(["admin", "manager"]), controller.remove);

export default router;
