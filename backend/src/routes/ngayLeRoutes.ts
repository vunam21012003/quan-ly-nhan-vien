import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import * as ngayLeController from "../controllers/ngayLeController";

const router = Router();

router.get("/", requireAuth, requireRole(["admin", "manager"]), ngayLeController.list);
router.post("/", requireAuth, requireRole(["admin"]), ngayLeController.create);
router.delete("/:id", requireAuth, requireRole(["admin"]), ngayLeController.remove);

export default router;
