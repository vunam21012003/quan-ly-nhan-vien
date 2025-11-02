// src/services/ngayLeService.ts
import { Request } from "express";
import { pool } from "../db";

// ── Helper: cộng ngày trên chuỗi yyyy-mm-dd (UTC-safe)
function addDaysStr(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map((n) => Number(n)) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export const getAll = async (req?: Request) => {
  const [rows]: any = await pool.query(
    `SELECT id,
            DATE_FORMAT(ngay, '%Y-%m-%d') AS ngay,
            ten_ngay, loai, mo_ta, so_ngay_nghi
     FROM ngay_le
     ORDER BY ngay ASC`
  );
  return rows;
};

export const create = async (req: Request) => {
  const { ngay, ten_ngay, loai, mo_ta, so_ngay_nghi } = req.body || {};
  if (!ngay || !ten_ngay) return { error: "Thiếu ngày hoặc tên ngày lễ", status: 400 };
  try {
    const [r]: any = await pool.query(
      `INSERT INTO ngay_le (ngay, ten_ngay, loai, mo_ta, so_ngay_nghi)
       VALUES (?, ?, ?, ?, ?)`,
      [ngay, ten_ngay, loai || "le", mo_ta || null, so_ngay_nghi || 1]
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

/** ✅ Trả về ngày đặc biệt cho 1 ymd (hỗ trợ kỳ nghỉ nhiều ngày, không lệch timezone) */
export const findHoliday = async (ymd: string) => {
  const target = String(ymd).slice(0, 10);

  const [rows]: any = await pool.query(
    `SELECT DATE_FORMAT(ngay, '%Y-%m-%d') AS ngay,
            loai,
            COALESCE(so_ngay_nghi, 1) AS so_ngay_nghi
     FROM ngay_le`
  );

  for (const r of rows) {
    const start = r.ngay as string; // yyyy-mm-dd
    const span = Number(r.so_ngay_nghi || 1);

    // Sinh các ngày trong kỳ nghỉ
    for (let i = 0; i < span; i++) {
      if (addDaysStr(start, i) === target) {
        return { loai: r.loai, ngay_bat_dau: start, so_ngay_nghi: span };
      }
    }
  }
  return null;
};
