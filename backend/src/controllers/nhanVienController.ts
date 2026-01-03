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

export const exportExcel = async (req: Request, res: Response) => {
  try {
    // Hàm service.exportExcel tự ghi file vào res và end()
    await service.exportExcel(req as any, res as any);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) {
      res.status(500).json({ status: false, message: "Server error" });
    }
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

export const updateNguoiPhuThuoc = async (req: any, res: any, next: any) => {
  try {
    const id = Number(req.params.id);
    const { so_nguoi_phu_thuoc } = req.body;

    const result = await service.updateNguoiPhuThuoc(req, id, so_nguoi_phu_thuoc);

    if (result?.error) {
      return res.status(400).json(result);
    }

    return res.json({ message: "Cập nhật số người phụ thuộc thành công", ...result });
  } catch (e) {
    next(e);
  }
};

export const getOverview = async (req: any, res: any) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID không hợp lệ" });

    const result = await service.getOverviewByNhanVienId(req, id);
    if ((result as any).error) {
      return res.status(400).json(result);
    }
    res.json({ data: result });
  } catch (e) {
    console.error("ERROR getOverview:", e);
    res.status(500).json({ error: "Server error" });
  }
};
