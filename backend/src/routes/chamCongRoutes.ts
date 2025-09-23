import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import * as chamCongController from "../controllers/chamCongController";

const router = Router();

router.get(
  "/",
  requireAuth,
  requireRole(["admin", "manager", "employee"]),
  chamCongController.list
);
router.get(
  "/:id",
  requireAuth,
  requireRole(["admin", "manager", "employee"]),
  chamCongController.detail
);
router.post("/", requireAuth, requireRole(["admin", "manager"]), chamCongController.create);
router.put("/:id", requireAuth, requireRole(["admin"]), chamCongController.update);
router.delete("/:id", requireAuth, requireRole(["admin"]), chamCongController.remove);

export default router;
