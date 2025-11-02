import { Request } from "express";
import { pool } from "../db";
import bcrypt from "bcryptjs";
import { TaiKhoan } from "../models/taiKhoan";
import { removeVietnameseTones } from "../utils/xoa-dau-tai-khoan";

// ================== LẤY DANH SÁCH ==================
export const getAll = async (req: Request) => {
  const [rows]: any = await pool.query(
    `
    SELECT tk.*, nv.ho_ten, cv.ten_chuc_vu, pb.ten_phong_ban
    FROM tai_khoan tk
    LEFT JOIN nhan_vien nv ON nv.id = tk.nhan_vien_id
    LEFT JOIN chuc_vu cv ON cv.id = nv.chuc_vu_id
    LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
    ORDER BY tk.id DESC
  `
  );
  return rows;
};

// ================== LẤY THEO ID ==================
export const getById = async (id: number) => {
  const [[row]]: any = await pool.query(
    `
    SELECT tk.*, nv.ho_ten, cv.ten_chuc_vu, pb.ten_phong_ban
    FROM tai_khoan tk
    LEFT JOIN nhan_vien nv ON nv.id = tk.nhan_vien_id
    LEFT JOIN chuc_vu cv ON cv.id = nv.chuc_vu_id
    LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
    WHERE tk.id = ?
    LIMIT 1
  `,
    [id]
  );
  return row || null;
};

// ================== TẠO TÀI KHOẢN ==================
export const create = async (body: TaiKhoan) => {
  const { nhan_vien_id, ten_dang_nhap, mat_khau, trang_thai, chuc_vu_id } = body;

  if (!nhan_vien_id || !ten_dang_nhap) return { error: "Thiếu thông tin bắt buộc" };

  // Kiểm tra trùng username
  const [[exists]]: any = await pool.query(
    "SELECT id FROM tai_khoan WHERE ten_dang_nhap = ? LIMIT 1",
    [ten_dang_nhap]
  );
  if (exists) return { error: "Tên đăng nhập đã tồn tại" };

  // 🔐 Mã hoá mật khẩu bằng bcrypt
  const hashedPassword = await bcrypt.hash(mat_khau?.trim() || "123456", 10);

  const [r]: any = await pool.query(
    `
    INSERT INTO tai_khoan (nhan_vien_id, chuc_vu_id, ten_dang_nhap, mat_khau, trang_thai)
    VALUES (?, ?, ?, ?, ?)
  `,
    [nhan_vien_id, chuc_vu_id || null, ten_dang_nhap, hashedPassword, trang_thai || "active"]
  );

  return { id: r.insertId };
};

// ================== TẠO TỰ ĐỘNG KHI THÊM NHÂN VIÊN ==================
export const createDefaultForNhanVien = async (nhan_vien_id: number, ho_ten: string) => {
  const username = removeVietnameseTones(ho_ten).toLowerCase().replace(/\s+/g, "");
  const hashed = await bcrypt.hash("123456", 10);

  const [r]: any = await pool.query(
    `
    INSERT INTO tai_khoan (nhan_vien_id, ten_dang_nhap, mat_khau, trang_thai)
    VALUES (?, ?, ?, 'active')
  `,
    [nhan_vien_id, username, hashed]
  );

  return { id: r.insertId, username };
};

// ================== CẬP NHẬT ==================
export const update = async (id: number, body: Partial<TaiKhoan>) => {
  const { ten_dang_nhap, mat_khau, trang_thai, chuc_vu_id } = body;

  // Nếu có thay đổi mật khẩu → hash lại
  const hashed = mat_khau ? await bcrypt.hash(mat_khau.trim(), 10) : undefined;

  const [r]: any = await pool.query(
    `
    UPDATE tai_khoan
    SET ten_dang_nhap = ?, 
        ${hashed ? "mat_khau = ?," : ""}
        trang_thai = ?, 
        chuc_vu_id = ?
    WHERE id = ?
  `,
    hashed
      ? [ten_dang_nhap, hashed, trang_thai || "active", chuc_vu_id || null, id]
      : [ten_dang_nhap, trang_thai || "active", chuc_vu_id || null, id]
  );

  if (!r.affectedRows) return { error: "Không tìm thấy tài khoản" };
  return { ok: true };
};

// ================== XOÁ ==================
export const remove = async (id: number) => {
  const [r]: any = await pool.query("DELETE FROM tai_khoan WHERE id = ?", [id]);
  if (!r.affectedRows) return { error: "Không tìm thấy tài khoản để xóa" };
  return { message: "Đã xóa tài khoản" };
};

// ================== ĐĂNG NHẬP ==================
export const login = async (username: string, password: string) => {
  const [[row]]: any = await pool.query(
    `
    SELECT tk.*, nv.ho_ten, cv.ten_chuc_vu
    FROM tai_khoan tk
    LEFT JOIN nhan_vien nv ON nv.id = tk.nhan_vien_id
    LEFT JOIN chuc_vu cv ON cv.id = tk.chuc_vu_id
    WHERE tk.ten_dang_nhap = ?
    LIMIT 1
  `,
    [username]
  );

  if (!row) return { error: "Sai tài khoản hoặc mật khẩu" };

  const ok = await bcrypt.compare(password.trim(), String(row.mat_khau).trim());
  if (!ok) return { error: "Sai tài khoản hoặc mật khẩu" };

  return row;
};
