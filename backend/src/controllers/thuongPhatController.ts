// src/controllers/thuongPhatController.ts
import { Request, Response } from "express";
import * as service from "../services/thuongPhatService";

/**
 * Lấy danh sách thưởng/phạt theo kỳ (tháng, năm)
 */
export const list = async (req: Request, res: Response) => {
  try {
    const data = await service.getList(req);
    res.json(data);
  } catch (err) {
    console.error("GET /thuong-phat error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Lấy chi tiết 1 bản ghi thưởng/phạt
 */
export const detail = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const data = await service.getById(id);
    if (!data) return res.status(404).json({ message: "Không tìm thấy" });
    res.json({ data });
  } catch (err) {
    console.error("GET /thuong-phat/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Tạo mới thưởng/phạt (P3)
 * ✅ Cập nhật để dùng cột `thang` và `nam` thay vì `thang_nam`
 */
export const create = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    if (!body.thang || !body.nam) {
      return res.status(400).json({ message: "Thiếu tháng hoặc năm" });
    }

    const data = await service.create(req);
    res.status(201).json(data);
  } catch (err) {
    console.error("POST /thuong-phat error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Cập nhật thưởng/phạt
 */
export const update = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const ok = await service.update(id, req);
    if (!ok) return res.status(404).json({ message: "Không tìm thấy" });
    res.json({ message: "Đã cập nhật" });
  } catch (err) {
    console.error("PUT /thuong-phat/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Xoá bản ghi thưởng/phạt
 */
export const remove = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const ok = await service.remove(id);
    if (!ok) return res.status(404).json({ message: "Không tìm thấy" });
    res.json({ message: "Đã xóa" });
  } catch (err) {
    console.error("DELETE /thuong-phat/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
