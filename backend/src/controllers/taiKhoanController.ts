import { Request, Response } from "express";
import * as taiKhoanService from "../services/taiKhoanService";

// ================== DANH SÁCH ==================
export const getAll = async (req: Request, res: Response) => {
  const result = await taiKhoanService.getAll(req);
  res.json(result);
};

// ================== LẤY THEO ID ==================
export const getById = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await taiKhoanService.getById(id);
  res.json(result);
};

// ================== TẠO ==================
export const create = async (req: Request, res: Response) => {
  // Loại bỏ chuc_vu_id khỏi req.body khi tạo thủ công
  const { chuc_vu_id, ...data } = req.body;
  const result = await taiKhoanService.create(data);
  res.json(result);
};

// ================== CẬP NHẬT ==================
export const update = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  // Loại bỏ chuc_vu_id khỏi req.body khi cập nhật thủ công
  const { chuc_vu_id, ...data } = req.body;
  const result = await taiKhoanService.update(id, data);
  res.json(result);
};

// ================== XOÁ ==================
export const remove = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await taiKhoanService.remove(id);
  res.json(result);
};

// ================== ĐĂNG NHẬP ==================
export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const result = await taiKhoanService.login(username, password);
  res.json(result);
};
