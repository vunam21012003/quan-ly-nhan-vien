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
    console.log("==== CREATE HOP DONG ====");
    console.log("BODY:", req.body);
    console.log("FILE:", req.file);

    if (req.file) {
      (req.body as any).file_hop_dong = "/uploads/" + req.file.filename;
    }

    const result = await service.create(req);
    if (result.error) return res.status(400).json({ message: result.error });
    res.status(201).json(result.data);
  } catch (e) {
    next(e);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log("==== UPDATE HOP DONG ====");
    console.log("PARAMS ID:", req.params.id);
    console.log("BODY:", req.body);
    console.log("FILE:", req.file);

    if (req.file) {
      (req.body as any).file_hop_dong = "/uploads/" + req.file.filename;
    }

    const result = await service.update(Number(req.params.id), req);

    if (result === null) {
      return res.status(404).json({ message: "Không tìm thấy" });
    }

    if (typeof result === "object" && "error" in result) {
      return res.status(403).json({ message: result.error });
    }

    if (result === true) {
      return res.json({ message: "Đã cập nhật" });
    }

    return res.status(400).json({ message: "Cập nhật thất bại" });
  } catch (e) {
    next(e);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.remove(Number(req.params.id), req);
    if (!result) return res.status(403).json({ message: "Không có quyền xoá hoặc không tìm thấy" });
    res.json({ message: "Đã xoá" });
  } catch (e) {
    next(e);
  }
};
