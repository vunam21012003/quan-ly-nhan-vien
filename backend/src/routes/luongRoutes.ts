import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import * as controller from "../controllers/luongController";

const router = Router();

router.get("/", requireAuth, requireRole(["admin", "manager"]), controller.getAll);
router.get("/me", requireAuth, requireRole(["admin", "manager", "employee"]), controller.getMine);
router.get("/:id", requireAuth, requireRole(["admin", "manager", "employee"]), controller.getById);
router.post("/", requireAuth, requireRole(["admin"]), controller.create);
router.put("/:id", requireAuth, requireRole(["admin"]), controller.update);
router.delete("/:id", requireAuth, requireRole(["admin"]), controller.remove);

// ✅ Tính lương theo tháng
router.post("/tinh-thang", requireAuth, requireRole(["admin"]), controller.calcSalary);

// ✅ Thêm route chia thưởng toàn hệ thống
router.post("/chia-thuong", requireAuth, requireRole(["admin"]), controller.chiaThuong);

export default router;
