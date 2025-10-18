import { Request, Response } from "express";
import * as service from "../services/phongBanService";

// Lấy danh sách phòng ban (có tìm kiếm + phân trang)
export const getAll = async (req: Request, res: Response) => {
  try {
    const search = (req.query.search as string) || "";
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const result = await service.getAll(search, page, limit);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
};

// Tạo mới phòng ban
export const create = async (req: Request, res: Response) => {
  try {
    const { ten, mo_ta, manager_taikhoan_id } = req.body || {};
    if (!ten) return res.status(400).json({ message: "Tên phòng ban là bắt buộc" });

    const result = await service.create(ten, mo_ta, manager_taikhoan_id);
    res.status(201).json({ id: result.id, message: "OK" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
};

// Cập nhật phòng ban
export const update = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { ten, mo_ta, manager_taikhoan_id } = req.body || {};
    const result = await service.update(id, ten, mo_ta, manager_taikhoan_id);

    if (!result.ok) return res.status(404).json({ message: "Không tìm thấy" });
    res.json({ message: "OK" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
};

// Xoá phòng ban
export const remove = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const result = await service.remove(id);

    if (!result.ok) return res.status(404).json({ message: "Không tìm thấy" });
    res.json({ message: "Đã xoá" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
};
