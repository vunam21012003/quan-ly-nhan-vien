// src/routes/trangChinhRoutes.ts
import { Router } from "express";
import { dashboardController } from "../controllers/trangChinhController";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// Bắt buộc login (để có req.user)
router.use(requireAuth);

// Admin + Manager + Employee đều được quyền gọi,
// nhưng dữ liệu trả về đã bị giới hạn theo role trong service.
router.get("/staff-summary", dashboardController.staffSummary);
router.get("/salary-by-department", dashboardController.salaryByDepartment);
router.get("/hours-summary", dashboardController.hoursSummary);
router.get("/rewards-summary", dashboardController.rewardsSummary);
router.get("/holidays", dashboardController.holidays);

// Lấy tất cả một lần
router.get("/complete", dashboardController.complete);

export default router;
