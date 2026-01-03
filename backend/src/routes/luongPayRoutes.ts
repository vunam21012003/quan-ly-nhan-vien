// src/routes/luongPayRoutes.ts
import { Router } from "express";
import { requireAuth, requireRole, requireKetoanOrAdmin } from "../middlewares/auth";
import * as controller from "../controllers/luongPayController";

const router = Router();

router.post(
  "/pay",
  requireAuth,
  requireRole(["admin", "manager"]),
  requireKetoanOrAdmin,
  controller.pay
);

router.post(
  "/pay-all",
  requireAuth,
  requireRole(["admin", "manager"]),
  requireKetoanOrAdmin,
  controller.payAll
);

export default router;
