import { Request, Response } from "express";
import * as service from "../services/chamCongService";

export const list = async (req: Request, res: Response) => {
  try {
    const data = await service.getList(req);
    res.json(data);
  } catch (err) {
    console.error("GET /cham-cong error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const detail = async (req: Request, res: Response) => {
  try {
    const data = await service.getDetail(req);
    if (!data) return res.status(404).json({ message: "Không tìm thấy" });
    res.json(data);
  } catch (err) {
    console.error("GET /cham-cong/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const result = await service.createChamCong(req);
    if (result.error) {
      return res.status(result.status || 400).json({ message: result.error });
    }
    res.status(201).json(result.data);
  } catch (err) {
    console.error("POST /cham-cong error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const update = async (req: Request, res: Response) => {
  try {
    const result = await service.updateChamCong(req);
    if (!result) return res.status(404).json({ message: "Không tìm thấy" });
    res.json({ message: "Đã cập nhật" });
  } catch (err) {
    console.error("PUT /cham-cong/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    const result = await service.deleteChamCong(req);
    if (!result) return res.status(404).json({ message: "Không tìm thấy" });
    res.json({ message: "Đã xoá" });
  } catch (err) {
    console.error("DELETE /cham-cong/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
