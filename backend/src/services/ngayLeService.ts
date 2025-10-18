import { Request } from "express";
import { pool } from "../db";

export const getAll = async (req?: Request) => {
  const [rows]: any = await pool.query(
    "SELECT id, ngay, ten_ngay, loai, he_so_luong, mo_ta FROM ngay_le ORDER BY ngay ASC"
  );
  return rows;
};

export const create = async (req: Request) => {
  const { ngay, ten_ngay, loai, mo_ta, he_so_luong, so_ngay_nghi } = req.body || {};
  if (!ngay || !ten_ngay) return { error: "Thiếu ngày hoặc tên ngày lễ", status: 400 };

  try {
    const [r]: any = await pool.query(
      `INSERT INTO ngay_le (ngay, ten_ngay, loai, he_so_luong, mo_ta, so_ngay_nghi)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [ngay, ten_ngay, loai || "le", he_so_luong || 3, mo_ta || null, so_ngay_nghi || 1]
    );
    return { data: { id: r.insertId, message: "Đã thêm" } };
  } catch (err: any) {
    if (err.code === "ER_DUP_ENTRY") return { error: "Ngày này đã tồn tại", status: 400 };
    throw err;
  }
};

export const remove = async (req: Request) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return { error: "ID không hợp lệ", status: 400 };
  const [r]: any = await pool.query("DELETE FROM ngay_le WHERE id = ?", [id]);
  if (r.affectedRows === 0) return { error: "Không tìm thấy ngày lễ", status: 404 };
  return { data: { message: "Đã xoá" } };
};

export const findHoliday = async (ngay: string) => {
  const [rows]: any = await pool.query(
    "SELECT ten_ngay, loai, he_so_luong FROM ngay_le WHERE ngay = ? LIMIT 1",
    [ngay]
  );
  return rows[0] || null;
};
