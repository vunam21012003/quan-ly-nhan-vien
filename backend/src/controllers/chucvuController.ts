// src/controllers/chucVuController.ts
import { Request, Response, NextFunction } from "express";
import * as service from "../services/chucvuService";

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = (req.query.search as string) || "";
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const phongBanId = req.query.phong_ban_id ? Number(req.query.phong_ban_id) : undefined;

    const data = await service.getAll(search, page, limit, phongBanId);
    res.json({ status: true, data });
  } catch (e) {
    next(e);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.create(req.body);
    res.json({ status: true, message: result.message, id: result.id });
  } catch (e) {
    next(e);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const success = await service.update(id, req.body);
    res.json({
      status: success,
      message: success ? "Cập nhật thành công" : "Không tìm thấy dữ liệu",
    });
  } catch (e) {
    next(e);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const success = await service.remove(id);
    res.json({ status: success, message: success ? "Đã xoá chức vụ" : "Không tìm thấy dữ liệu" });
  } catch (e) {
    next(e);
  }
};
