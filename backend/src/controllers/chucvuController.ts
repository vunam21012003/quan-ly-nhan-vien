import { Request, Response, NextFunction } from "express";
import * as service from "../services/chucvuService";

export const list = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getAll();
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ten_chuc_vu } = req.body || {};
    if (!ten_chuc_vu) return res.status(400).json({ message: "ten_chuc_vu là bắt buộc" });

    const result = await service.create(ten_chuc_vu);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const { ten_chuc_vu } = req.body || {};
    const ok = await service.update(id, ten_chuc_vu || null);
    if (!ok) return res.status(404).json({ message: "Không tìm thấy" });
    res.json({ message: "OK" });
  } catch (err) {
    next(err);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const ok = await service.remove(id);
    if (!ok) return res.status(404).json({ message: "Không tìm thấy" });
    res.json({ message: "Đã xoá" });
  } catch (err) {
    next(err);
  }
};
