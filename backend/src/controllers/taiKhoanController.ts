import { Request, Response } from "express";
import * as service from "../services/taiKhoanService";

export const getAll = async (_req: Request, res: Response) => {
  try {
    const data = await service.getAll();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const result = await service.create(req.body);
    if (result.errorCode === "DUPLICATE") {
      return res.status(409).json({ message: "Tên đăng nhập đã tồn tại" });
    }
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    res.status(201).json({ id: result.id, message: "OK" });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ message: "password là bắt buộc" });

    const result = await service.changePassword(id, password);
    if (!result.ok) return res.status(404).json({ message: "Không tìm thấy" });

    res.json({ message: "Đã đổi mật khẩu" });
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
