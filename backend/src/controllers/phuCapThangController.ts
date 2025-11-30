// src/controllers/phuCapThangController.ts
import { Request, Response } from "express";
import * as service from "../services/phuCapThangService";

export const list = async (req: Request, res: Response) => {
  try {
    // ⭐ Lấy phạm vi người dùng đã được middleware requireRole gán vào req.phamvi
    const phamvi = (req as any).phamvi;

    if (!phamvi) {
      return res.status(401).json({ error: "Không xác định phạm vi người dùng" });
    }

    // ⭐ Truyền toàn bộ query + phạm vi vào service
    const result = await service.list({
      ...req.query,
      __phamvi: phamvi, // quan trọng!
    });

    return res.json({ data: result.data });
  } catch (err) {
    console.error("❌ Lỗi controller list phụ cấp tháng:", err);
    return res.status(500).json({ error: "Lỗi server" });
  }
};

export const create = async (req: Request, res: Response) => {
  const result = await service.create(req.body, req);
  res.json(result);
};

export const update = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await service.update(id, req.body, req);
  res.json(result);
};

export const remove = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await service.remove(id, req);
  res.json(result);
};

// export const autoCopy = async (req: Request, res: Response) => {
//   const { thang, nam } = req.body;
//   const result = await service.autoCopyFromLastMonth(thang, nam);
//   res.json(result);
// };
