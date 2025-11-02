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
    if (!result) return res.status(404).json({ message: "Không tìm thấy" });
    res.json(result);
  } catch (e) {
    next(e);
  }
};

/* ==================== TẠO HỢP ĐỒNG ==================== */
export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.file) {
      (req.body as any).file_hop_dong = "/uploads/" + req.file.filename;
    }

    // 🟢 Đảm bảo parse các phụ cấp về dạng số
    const fields = [
      "phu_cap_co_dinh",
      "phu_cap_tham_nien",
      "phu_cap_nang_luc",
      "phu_cap_trach_nhiem",
      "luong_thoa_thuan",
    ];
    for (const f of fields) {
      if (req.body[f]) req.body[f] = Number(req.body[f]);
    }

    const result = await service.create(req);
    if (result.error) return res.status(400).json({ message: result.error });
    res.status(201).json(result.data);
  } catch (e) {
    next(e);
  }
};

/* ==================== CẬP NHẬT HỢP ĐỒNG ==================== */
export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.file) {
      (req.body as any).file_hop_dong = "/uploads/" + req.file.filename;
    }

    // 🟢 Parse lại các giá trị phụ cấp
    const fields = [
      "phu_cap_co_dinh",
      "phu_cap_tham_nien",
      "phu_cap_nang_luc",
      "phu_cap_trach_nhiem",
      "luong_thoa_thuan",
    ];
    for (const f of fields) {
      if (req.body[f]) req.body[f] = Number(req.body[f]);
    }

    const result = await service.update(Number(req.params.id), req);

    if (result === null) return res.status(404).json({ message: "Không tìm thấy" });
    if (typeof result === "object" && "error" in result)
      return res.status(403).json({ message: result.error });
    if (result === true) return res.json({ message: "Đã cập nhật" });

    return res.status(400).json({ message: "Cập nhật thất bại" });
  } catch (e) {
    next(e);
  }
};

/* ==================== XOÁ HỢP ĐỒNG ==================== */
export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.remove(Number(req.params.id), req);
    if (!result) return res.status(403).json({ message: "Không có quyền xoá hoặc không tìm thấy" });
    res.json({ message: "Đã xoá" });
  } catch (e) {
    next(e);
  }
};
