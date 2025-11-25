// src/services/lichSuTraLuongService.ts
import { pool } from "../db";

export const getList = async (query: any) => {
  const page = Math.max(parseInt(String(query.page ?? "1"), 10), 1);
  const limit = Math.max(parseInt(String(query.limit ?? "20"), 10), 1);
  const offset = (page - 1) * limit;

  const thang = query.thang ? Number(query.thang) : undefined;
  const nam = query.nam ? Number(query.nam) : undefined;
  const nhan_vien_id = query.nhan_vien_id ? Number(query.nhan_vien_id) : undefined;
  const trang_thai = query.trang_thai?.trim();
  const tu_ngay = query.tu_ngay?.trim();
  const den_ngay = query.den_ngay?.trim();
  const q = query.q?.trim();

  const where: string[] = [];
  const params: any[] = [];

  if (!Number.isNaN(thang)) {
    where.push("ls.thang = ?");
    params.push(thang);
  }
  if (!Number.isNaN(nam)) {
    where.push("ls.nam = ?");
    params.push(nam);
  }
  if (!Number.isNaN(nhan_vien_id)) {
    where.push("ls.nhan_vien_id = ?");
    params.push(nhan_vien_id);
  }
  if (trang_thai) {
    where.push("ls.trang_thai = ?");
    params.push(trang_thai);
  }
  if (tu_ngay) {
    where.push("ls.ngay_tra >= ?");
    params.push(tu_ngay);
  }
  if (den_ngay) {
    where.push("ls.ngay_tra <= ?");
    params.push(den_ngay);
  }
  if (q) {
    where.push("nv.ho_ten LIKE ?");
    params.push(`%${q}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // Tổng số bản ghi
  const [countRows]: any = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM lich_su_tra_luong ls
    JOIN nhan_vien nv ON nv.id = ls.nhan_vien_id
    ${whereSql}
  `,
    params
  );
  const total = countRows[0]?.total ?? 0;

  // Dữ liệu trang hiện tại
  const [rows] = await pool.query(
    `
    SELECT
      ls.id,
      ls.nhan_vien_id,
      nv.ho_ten,
      ls.thang,
      ls.nam,
      ls.so_tien_thuc_tra AS tong_luong,
      ls.ngay_tra,
      ls.trang_thai,
      ls.ghi_chu,
      ls.nguoi_thuc_hien_id
    FROM lich_su_tra_luong ls
    JOIN nhan_vien nv ON nv.id = ls.nhan_vien_id
    ${whereSql}
    ORDER BY ls.ngay_tra DESC, ls.id DESC
    LIMIT ? OFFSET ?
  `,
    [...params, limit, offset]
  );

  return { page, limit, total, items: rows };
};

export const create = async (body: any) => {
  const { nhan_vien_id, thang, nam, so_tien_thuc_tra, ngay_tra, trang_thai, ghi_chu } = body;

  if (!nhan_vien_id || !thang || !nam || so_tien_thuc_tra === undefined || !ngay_tra) {
    return { error: "Thiếu tham số bắt buộc" };
  }

  const sql = `
    INSERT INTO lich_su_tra_luong
      (nhan_vien_id, thang, nam, so_tien_thuc_tra, ngay_tra, trang_thai, ghi_chu)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const [result] = await pool.execute(sql, [
    nhan_vien_id,
    thang,
    nam,
    so_tien_thuc_tra,
    ngay_tra,
    trang_thai ?? "cho_xu_ly",
    ghi_chu ?? null,
  ]);

  return { id: (result as any).insertId };
};

export const update = async (id: number, body: any) => {
  if (!Number.isInteger(id) || id <= 0) {
    return { error: "id không hợp lệ" };
  }

  const allowed = [
    "nhan_vien_id",
    "thang",
    "nam",
    "so_tien_thuc_tra",
    "ngay_tra",
    "trang_thai",
    "ghi_chu",
  ] as const;

  const fields = allowed.filter((k) => body?.[k] !== undefined);
  if (!fields.length) return { error: "Không có trường nào để cập nhật" };

  const sets = fields.map((k) => `${k} = ?`).join(", ");
  const values = fields.map((k) => body[k]);

  await pool.execute(`UPDATE lich_su_tra_luong SET ${sets} WHERE id = ?`, [...values, id]);

  return { ok: true };
};

export const remove = async (id: number) => {
  if (!Number.isInteger(id) || id <= 0) return false;
  await pool.execute("DELETE FROM lich_su_tra_luong WHERE id = ?", [id]);
  return true;
};
