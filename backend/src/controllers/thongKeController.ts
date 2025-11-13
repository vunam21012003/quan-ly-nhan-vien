import { Request, Response } from "express";
import * as thongKeService from "../services/thongKeService";

// Lấy thống kê cho Admin/Manager
export const getAdminManagerStats = async (req: Request, res: Response) => {
  try {
    const stats = await thongKeService.getAdminManagerStats();
    res.json(stats);
  } catch (err: any) {
    console.error("Lỗi Controller Thống kê Admin:", err);
    res.status(500).json({ message: "Lỗi máy chủ khi lấy thống kê" });
  }
};

// Lấy thống kê cá nhân cho Employee
export const getEmployeeStats = async (req: Request, res: Response) => {
  try {
    const nhanVienId = req.user!.id; // Giả định middleware auth đính kèm user.id
    const stats = await thongKeService.getEmployeeStats(nhanVienId);
    res.json(stats);
  } catch (err: any) {
    console.error("Lỗi Controller Thống kê NV:", err);
    res.status(500).json({ message: "Lỗi máy chủ khi lấy thông tin cá nhân" });
  }
};
