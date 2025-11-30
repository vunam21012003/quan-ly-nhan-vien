//phanTichCongRoutes.ts
import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import * as controller from "../controllers/phanTichCongController";

const router = Router();

router.get("/", requireAuth, requireRole(["admin", "manager", "employee"]), controller.getAll);

router.post("/", requireAuth, requireRole(["admin", "manager"]), controller.create);

export default router;
