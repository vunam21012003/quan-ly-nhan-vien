// src/controllers/authController.ts
import { Request, Response } from "express";
import * as authService from "../services/authService";
import { layPhamViNguoiDung } from "../utils/pham-vi-nguoi-dung";
import { pool } from "../db";

export const register = async (req: Request, res: Response) => {
  const result = await authService.register(req.body);
  if (result.error) {
    return res.status(result.status || 500).json({ error: result.error });
  }
  return res.status(201).json(result.data);
};

export const login = async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
  if (result.error) {
    return res.status(result.status || 500).json({ error: result.error });
  }
  return res.json(result.data);
};

export const changePassword = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const result = await authService.changePassword(userId, req.body);
  if (result.error) {
    return res.status(result.status || 500).json({ error: result.error });
  }
  return res.json(result.data);
};

export const me = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const phamvi = await layPhamViNguoiDung(req);

    return res.json({
      ...user,
      ...phamvi,
    });
  } catch (err) {
    console.error("auth/me error:", err);
    return res.status(500).json({ error: getErrorMessage(err) });
  }
};

export const checkPermissions = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const phamvi = await layPhamViNguoiDung(req);

    const [[details]]: any = await pool.query(
      `
      SELECT 
        tk.id as tai_khoan_id,
        tk.ten_dang_nhap,
        tk.nhan_vien_id,
        nv.ho_ten,
        nv.phong_ban_id,
        cv.ten_chuc_vu,
        cv.quyen_mac_dinh,
        pb.ten_phong_ban,
        pb.manager_taikhoan_id
      FROM tai_khoan tk
      LEFT JOIN nhan_vien nv ON tk.nhan_vien_id = nv.id
      LEFT JOIN chuc_vu cv ON nv.chuc_vu_id = cv.id
      LEFT JOIN phong_ban pb ON nv.phong_ban_id = pb.id
      WHERE tk.id = ?
      `,
      [user.id]
    );

    const [managedDepts]: any = await pool.query(
      `SELECT id, ten_phong_ban FROM phong_ban WHERE manager_taikhoan_id = ?`,
      [user.id]
    );

    return res.json({
      tokenUser: user,
      phamvi,
      details,
      managedDepartments: managedDepts,
      isTruongPhong: managedDepts.length > 0,
    });
  } catch (err) {
    console.error("checkPermissions error:", err);
    return res.status(500).json({ error: getErrorMessage(err) });
  }
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

export const forgotPassword = async (req: Request, res: Response) => {
  const result = await authService.forgotPassword(req.body);
  if (result.error) {
    return res.status(result.status || 500).json({ error: result.error });
  }
  return res.json(result.data);
};
