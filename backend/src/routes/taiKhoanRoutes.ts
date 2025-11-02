import { Router } from "express";
import * as taiKhoanController from "../controllers/taiKhoanController";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

router.get("/", requireAuth, requireRole(["admin", "manager"]), taiKhoanController.getAll);
router.get("/:id", requireAuth, requireRole(["admin", "manager"]), taiKhoanController.getById);
router.post("/", requireAuth, requireRole(["admin"]), taiKhoanController.create);
router.put("/:id", requireAuth, requireRole(["admin"]), taiKhoanController.update);
router.delete("/:id", requireAuth, requireRole(["admin"]), taiKhoanController.remove);

router.post("/login", taiKhoanController.login);

export default router;
