// src/controllers/hopDongController.ts
import { Request, Response, NextFunction } from "express";
import * as service from "../services/hopDongService";

/* ==================== DANH SÁCH ==================== */
export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.getAll(req);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

/* ==================== CHI TIẾT ==================== */
export const detail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.getDetail(req);
    if (!result) return res.status(404).json({ message: "Không tìm thấy hợp đồng" });
    res.json(result);
  } catch (e) {
    next(e);
  }
};

/* ==================== TẠO MỚI ==================== */
export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.create(req);
    if ((result as any)?.error) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (e) {
    next(e);
  }
};

/* ==================== CẬP NHẬT ==================== */
export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const result = await service.update(id, req);
    if ((result as any)?.error) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (e) {
    next(e);
  }
};

/* ==================== XOÁ HỢP ĐỒNG ==================== */
export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const ok = await service.remove(id, req);
    if (!ok) return res.status(403).json({ message: "Không có quyền xoá hoặc không tìm thấy" });
    res.json({ message: "Đã xoá" });
  } catch (e) {
    next(e);
  }
};
