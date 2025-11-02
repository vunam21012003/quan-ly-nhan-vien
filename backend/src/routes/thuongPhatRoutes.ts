import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import * as controller from "../controllers/thuongPhatController";

const router = Router();

router.get("/", requireAuth, requireRole(["admin", "manager"]), controller.list);
router.get("/:id", requireAuth, requireRole(["admin", "manager"]), controller.detail);
router.post("/", requireAuth, requireRole(["admin", "manager"]), controller.create);
router.put("/:id", requireAuth, requireRole(["admin", "manager"]), controller.update);
router.delete("/:id", requireAuth, requireRole(["admin"]), controller.remove);

export default router;
