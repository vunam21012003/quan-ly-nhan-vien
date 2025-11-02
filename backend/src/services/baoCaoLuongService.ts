import { pool } from "../db";

export const getBaoCaoLuong = async (query: any) => {
  const page = Math.max(parseInt(String(query.page ?? "1"), 10), 1);
  const limit = Math.max(parseInt(String(query.limit ?? "20"), 10), 1);
  const offset = (page - 1) * limit;

  const thang = query.thang ? parseInt(String(query.thang), 10) : undefined;
  const nam = query.nam ? parseInt(String(query.nam), 10) : undefined;
  const phong_ban_id = query.phong_ban_id ? parseInt(String(query.phong_ban_id), 10) : undefined;
  const chuc_vu_id = query.chuc_vu_id ? parseInt(String(query.chuc_vu_id), 10) : undefined;
  const q = (query.q as string | undefined)?.trim();

  const where: string[] = [];
  const params: any[] = [];

  if (!Number.isNaN(thang)) {
    where.push("l.thang = ?");
    params.push(thang);
  }
  if (!Number.isNaN(nam)) {
    where.push("l.nam = ?");
    params.push(nam);
  }
  if (!Number.isNaN(phong_ban_id)) {
    where.push("nv.phong_ban_id = ?");
    params.push(phong_ban_id);
  }
  if (!Number.isNaN(chuc_vu_id)) {
    where.push("nv.chuc_vu_id = ?");
    params.push(chuc_vu_id);
  }
  if (q) {
    where.push("nv.ho_ten LIKE ?");
    params.push(`%${q}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countSql = `
    SELECT COUNT(*) AS total
    FROM luong l
    JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
    LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
    LEFT JOIN chuc_vu  cv ON cv.id = nv.chuc_vu_id
    ${whereSql}
  `;
  const [countRows] = await pool.query(countSql, params);
  const total = (countRows as any[])[0]?.total ?? 0;

  const dataSql = `
    SELECT
      l.id,
      l.nhan_vien_id,
      nv.ho_ten,
      pb.ten_phong_ban,
      cv.ten_chuc_vu,
      l.thang,
      l.nam,
      l.luong_thoa_thuan,
      l.phu_cap,
      l.thuong,
      l.khau_tru,
      (COALESCE(l.luong_thoa_thuan,0) + COALESCE(l.phu_cap,0) + COALESCE(l.thuong,0) - COALESCE(l.khau_tru,0)) AS tong_luong
    FROM luong l
    JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
    LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
    LEFT JOIN chuc_vu  cv ON cv.id = nv.chuc_vu_id
    ${whereSql}
    ORDER BY l.nam DESC, l.thang DESC, tong_luong DESC, l.id DESC
    LIMIT ? OFFSET ?
  `;
  const dataParams = [...params, limit, offset];
  const [rows] = await pool.query(dataSql, dataParams);

  return { page, limit, total, items: rows };
};

export const getChiTietLuongNhanVien = async (
  nhan_vien_id: number,
  filter: { thang?: any; nam?: any }
) => {
  const thang = filter.thang ? parseInt(String(filter.thang), 10) : undefined;
  const nam = filter.nam ? parseInt(String(filter.nam), 10) : undefined;

  const where: string[] = ["l.nhan_vien_id = ?"];
  const params: any[] = [nhan_vien_id];

  if (!Number.isNaN(thang)) {
    where.push("l.thang = ?");
    params.push(thang);
  }
  if (!Number.isNaN(nam)) {
    where.push("l.nam = ?");
    params.push(nam);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const sql = `
    SELECT
      l.id,
      l.nhan_vien_id,
      nv.ho_ten,
      pb.ten_phong_ban,
      cv.ten_chuc_vu,
      l.thang,
      l.nam,
      l.luong_thoa_thuan,
      l.phu_cap,
      l.thuong,
      l.khau_tru,
      (COALESCE(l.luong_thoa_thuan,0) + COALESCE(l.phu_cap,0) + COALESCE(l.thuong,0) - COALESCE(l.khau_tru,0)) AS tong_luong
    FROM luong l
    JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
    LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
    LEFT JOIN chuc_vu  cv ON cv.id = nv.chuc_vu_id
    ${whereSql}
    ORDER BY l.nam DESC, l.thang DESC, l.id DESC
  `;
  const [rows] = await pool.query(sql, params);

  return { nhan_vien_id, items: rows };
};
