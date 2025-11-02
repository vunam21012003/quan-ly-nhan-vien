import { Request, Response } from "express";
import * as service from "../services/nhanVienService";

export const list = async (req: Request, res: Response) => {
  try {
    const data = await service.getAll(req);
    res.json({ status: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

export const getById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const row = await service.getById(req, id);
    if (!row)
      return res.status(404).json({ status: false, message: "Không có quyền hoặc không tìm thấy" });
    res.json({ status: true, data: row });
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const result = await service.create(req, req.body);
    if ((result as any).error) return res.status(403).json(result);
    res.status(201).json({ status: true, ...result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const result = await service.update(req, id, req.body);
    if ((result as any).error) return res.status(403).json(result);
    res.json({ status: true, ...result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const result = await service.remove(req, id);
    if ((result as any).error) return res.status(403).json(result);
    res.json({ status: true, ...result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

// cho trang Chức vụ
export const getByChucVu = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.chuc_vu_id);
    const items = await service.getByChucVu(id);
    res.json({ items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};
