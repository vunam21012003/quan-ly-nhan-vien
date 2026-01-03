//taiKhoanController.ts
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
  const user = (req as any).user;

  // Admin xem tất cả
  if (user.role !== "admin" && user.id !== id) {
    return res.status(403).json({ error: "Bạn không có quyền xem tài khoản này." });
  }

  const result = await taiKhoanService.getById(id);
  res.json(result);
};

// ================== LẤY THEO NHÂN VIÊN ==================
export const getByNhanVienId = async (req: Request, res: Response) => {
  const nhan_vien_id = Number(req.params.id);
  const result = await taiKhoanService.getByNhanVienId(nhan_vien_id);
  res.json({ data: result });
};

// ================== CẬP NHẬT MẬT KHẨU (Manager & Employee) ==================
export const updatePassword = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const user = (req as any).user;

  // ❗ Employee / Manager chỉ đổi mật khẩu của chính họ
  if (user.role !== "admin" && user.id !== id) {
    return res.status(403).json({ error: "Bạn chỉ được đổi mật khẩu của tài khoản của bạn." });
  }

  const { mat_khau_cu, mat_khau_moi } = req.body;

  if (!mat_khau_cu || !mat_khau_moi)
    return res.status(400).json({ error: "Thiếu mật khẩu cũ / mới" });

  const result = await taiKhoanService.updatePassword(id, mat_khau_cu, mat_khau_moi);
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

// ================== DANH SÁCH TÀI KHOẢN CHỌN TRƯỞNG PHÒNG ==================
export const getForManagerSelect = async (req: Request, res: Response) => {
  try {
    const phong_ban_id = req.query.phong_ban_id ? Number(req.query.phong_ban_id) : undefined;

    const result = await taiKhoanService.getForManagerSelect(phong_ban_id);
    res.json(result);
  } catch (e) {
    console.error("SERVER ERROR getForManagerSelect:", e);
    res.status(500).json({ error: "Server error" });
  }
};
