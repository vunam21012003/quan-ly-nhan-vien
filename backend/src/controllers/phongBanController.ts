import { Request, Response } from "express";
import * as service from "../services/phongBanService";

export const getAll = async (_req: Request, res: Response) => {
  try {
    const result = await service.getAll();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const { ten_phong_ban } = req.body || {};
    if (!ten_phong_ban) return res.status(400).json({ message: "ten_phong_ban là bắt buộc" });

    const result = await service.create(ten_phong_ban);
    res.status(201).json({ id: result.id, message: "OK" });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { ten_phong_ban } = req.body || {};
    const result = await service.update(id, ten_phong_ban);

    if (!result.ok) return res.status(404).json({ message: "Không tìm thấy" });
    res.json({ message: "OK" });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const result = await service.remove(id);

    if (!result.ok) return res.status(404).json({ message: "Không tìm thấy" });
    res.json({ message: "Đã xoá" });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
};
