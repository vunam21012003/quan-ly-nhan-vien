// src/controllers/phanTichCongController.ts
import { Request, Response } from "express";
import * as service from "../services/phanTichCongService";

/**
 * Lấy danh sách phân tích công (P3 data source)
 * Tính toán từ chấm công => tổng giờ, tăng ca, nghỉ phép...
 */
export const getAll = async (req: Request, res: Response) => {
  try {
    const rows = await service.getAll(req);
    res.json(rows);
  } catch (e) {
    console.error("[phanTichCongController.getAll]", e);
    res.status(500).json({ error: "Server error" });
  }
};

/**
 * Tạo mới bản ghi phân tích công (dành cho kế toán nhập tay)
 */
export const create = async (req: Request, res: Response) => {
  try {
    const result = await service.create(req);
    if (result.error) {
      const statusCode = (result as any).status || 400;
      return res.status(statusCode).json({ message: (result as any).error });
    }
    res.status(201).json({ id: result.id, message: "OK" });
  } catch (e) {
    console.error("[phanTichCongController.create]", e);
    res.status(500).json({ error: "Server error" });
  }
};
