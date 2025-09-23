import { Request, Response, NextFunction } from "express";
import * as service from "../services/hopDongService";

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.getAll(req);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

export const detail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.getDetail(req);
    if (!result) return res.status(404).json({ message: "Không tìm thấy" });
    res.json(result);
  } catch (e) {
    next(e);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.create(req.body);
    if (result.error) return res.status(400).json({ message: result.error });
    res.status(201).json(result.data);
  } catch (e) {
    next(e);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.update(Number(req.params.id), req.body);
    if (!result) return res.status(404).json({ message: "Không tìm thấy" });
    res.json({ message: "Đã cập nhật" });
  } catch (e) {
    next(e);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.remove(Number(req.params.id));
    if (!result) return res.status(404).json({ message: "Không tìm thấy" });
    res.json({ message: "Đã xoá" });
  } catch (e) {
    next(e);
  }
};
