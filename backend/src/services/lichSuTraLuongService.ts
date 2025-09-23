import { pool } from "../db";

export const getList = async (query: any) => {
  const page = Math.max(parseInt(String(query.page ?? "1"), 10), 1);
  const limit = Math.max(parseInt(String(query.limit ?? "20"), 10), 1);
  const offset = (page - 1) * limit;

  const thang = query.thang ? parseInt(String(query.thang), 10) : undefined;
  const nam = query.nam ? parseInt(String(query.nam), 10) : undefined;
  const nhan_vien_id = query.nhan_vien_id ? parseInt(String(query.nhan_vien_id), 10) : undefined;
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

  const countSql = `
    SELECT COUNT(*) AS total
    FROM lich_su_tra_luong ls
    JOIN nhan_vien nv ON nv.id = ls.nhan_vien_id
    ${whereSql}
  `;
  const [countRows] = await pool.query(countSql, params);
  const total = (countRows as any[])[0]?.total ?? 0;

  const dataSql = `
    SELECT
      ls.id,
      ls.nhan_vien_id,
      nv.ho_ten,
      ls.thang,
      ls.nam,
      ls.tong_luong,
      ls.ngay_tra
    FROM lich_su_tra_luong ls
    JOIN nhan_vien nv ON nv.id = ls.nhan_vien_id
    ${whereSql}
    ORDER BY ls.ngay_tra DESC, ls.nam DESC, ls.thang DESC, ls.id DESC
    LIMIT ? OFFSET ?
  `;
  const dataParams = [...params, limit, offset];
  const [rows] = await pool.query(dataSql, dataParams);

  return { page, limit, total, items: rows };
};

export const create = async (body: any) => {
  const { nhan_vien_id, thang, nam, tong_luong, ngay_tra } = body;
  if (!nhan_vien_id || !thang || !nam || tong_luong === undefined || !ngay_tra) {
    return { error: "nhan_vien_id, thang, nam, tong_luong, ngay_tra là bắt buộc" };
  }

  const sql = `
    INSERT INTO lich_su_tra_luong
      (nhan_vien_id, thang, nam, tong_luong, ngay_tra)
    VALUES
      (?, ?, ?, ?, ?)
  `;
  const [result] = await pool.execute(sql, [nhan_vien_id, thang, nam, tong_luong, ngay_tra]);

  return { id: (result as any).insertId };
};

export const update = async (id: number, body: any) => {
  if (!Number.isInteger(id) || id <= 0) {
    return { error: "id không hợp lệ" };
  }

  const allowed = ["nhan_vien_id", "thang", "nam", "tong_luong", "ngay_tra"] as const;
  const fields = allowed.filter((k) => body?.[k] !== undefined);
  if (!fields.length) {
    return { error: "Không có trường nào để cập nhật" };
  }

  const sets = fields.map((k) => `${k} = ?`).join(", ");
  const values = fields.map((k) => body[k]);

  const sql = `UPDATE lich_su_tra_luong SET ${sets} WHERE id = ?`;
  await pool.execute(sql, [...values, id]);

  return { ok: true };
};

export const remove = async (id: number) => {
  if (!Number.isInteger(id) || id <= 0) return false;
  await pool.execute("DELETE FROM lich_su_tra_luong WHERE id = ?", [id]);
  return true;
};
