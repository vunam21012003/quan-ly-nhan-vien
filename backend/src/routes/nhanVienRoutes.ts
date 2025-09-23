import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import * as controller from "../controllers/nhanVienController";

const router = Router();

router.get("/", requireAuth, requireRole(["admin", "manager", "employee"]), controller.getAll);
router.get("/:id", requireAuth, requireRole(["admin", "manager", "employee"]), controller.getById);
router.post("/", requireAuth, requireRole(["admin"]), controller.create);
router.put("/:id", requireAuth, requireRole(["admin"]), controller.update);
router.patch("/:id", requireAuth, requireRole(["admin"]), controller.partialUpdate);
router.delete("/:id", requireAuth, requireRole(["admin"]), controller.remove);

export default router;
