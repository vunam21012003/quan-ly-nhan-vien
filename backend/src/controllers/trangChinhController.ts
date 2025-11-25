// src/controllers/trangChinhController.ts
import { Request, Response } from "express";
import { dashboardService } from "../services/trangChinhService";
import { layPhamViNguoiDung } from "../utils/pham-vi-nguoi-dung";

export const dashboardController = {
  // GET /staff-summary
  async staffSummary(req: Request, res: Response) {
    try {
      const phamvi = await layPhamViNguoiDung(req);
      const data = await dashboardService.getStaffSummary(phamvi);
      return res.json(data);
    } catch (err) {
      console.error("[GET /trang-chinh/staff-summary] Lỗi:", err);
      return res.status(500).json({ error: "Lỗi server" });
    }
  },

  // GET /salary-by-department
  async salaryByDepartment(req: Request, res: Response) {
    try {
      const phamvi = await layPhamViNguoiDung(req);
      const data = await dashboardService.getSalaryByDepartment(phamvi);
      return res.json(data);
    } catch (err) {
      console.error("[GET /trang-chinh/salary-by-department] Lỗi:", err);
      return res.status(500).json({ error: "Lỗi server" });
    }
  },

  // GET /hours-summary
  async hoursSummary(req: Request, res: Response) {
    try {
      const phamvi = await layPhamViNguoiDung(req);
      const data = await dashboardService.getHoursSummary(phamvi);
      return res.json(data);
    } catch (err) {
      console.error("[GET /trang-chinh/hours-summary] Lỗi:", err);
      return res.status(500).json({ error: "Lỗi server" });
    }
  },

  // GET /rewards-summary
  async rewardsSummary(req: Request, res: Response) {
    try {
      const phamvi = await layPhamViNguoiDung(req);
      const data = await dashboardService.getRewardsSummary(phamvi);
      return res.json(data);
    } catch (err) {
      console.error("[GET /trang-chinh/rewards-summary] Lỗi:", err);
      return res.status(500).json({ error: "Lỗi server" });
    }
  },

  // GET /holidays
  async holidays(req: Request, res: Response) {
    try {
      const data = await dashboardService.getUpcomingHolidays();
      return res.json({ items: data });
    } catch (err) {
      console.error("[GET /trang-chinh/holidays] Lỗi:", err);
      return res.status(500).json({ error: "Lỗi server" });
    }
  },

  // GET /complete
  async complete(req: Request, res: Response) {
    try {
      const phamvi = await layPhamViNguoiDung(req);
      const data = await dashboardService.getCompleteDashboardData(phamvi);
      return res.json(data);
    } catch (err) {
      console.error("[GET /trang-chinh/complete] Lỗi:", err);
      return res.status(500).json({ error: "Lỗi server" });
    }
  },
};
