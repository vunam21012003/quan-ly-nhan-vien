import { Request } from "express";
import { pool } from "../db";

export const getList = async (req: Request) => {
  const { nhan_vien_id, loai, thang, nam } = req.query as any;
  const where: string[] = [];
  const params: any[] = [];

  if (nhan_vien_id) {
    where.push("tp.nhan_vien_id = ?");
    params.push(nhan_vien_id);
  }

  if (loai) {
    where.push("tp.loai = ?");
    params.push(loai);
  }

  // ✅ Dùng cột riêng thang và nam thay vì thang_nam
  if (thang) {
    where.push("tp.thang = ?");
    params.push(thang);
  }
  if (nam) {
    where.push("tp.nam = ?");
    params.push(nam);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows]: any = await pool.query(
    `SELECT tp.*, nv.ho_ten, pb.ten_phong_ban
     FROM thuong_phat tp
     LEFT JOIN nhan_vien nv ON nv.id = tp.nhan_vien_id
     LEFT JOIN phong_ban pb ON pb.id = tp.phong_ban_id
     ${whereSql}
     ORDER BY tp.ngay_tao DESC`,
    params
  );

  return { items: rows };
};

export const getById = async (id: number) => {
  const [rows]: any = await pool.query("SELECT * FROM thuong_phat WHERE id=?", [id]);
  return rows[0] || null;
};

export const create = async (req: Request) => {
  const { nhan_vien_id, phong_ban_id, loai, ly_do, so_tien, ghi_chu, thang, nam } = req.body;
  const user = (req as any).user;

  const [r]: any = await pool.query(
    `INSERT INTO thuong_phat 
     (nhan_vien_id, phong_ban_id, thang, nam, loai, ly_do, so_tien, ghi_chu, nguoi_tao_id, ngay_tao)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [nhan_vien_id, phong_ban_id, thang, nam, loai, ly_do, so_tien, ghi_chu, user.id]
  );

  return { id: r.insertId };
};

export const update = async (id: number, req: Request) => {
  const { nhan_vien_id, phong_ban_id, loai, ly_do, so_tien, ghi_chu } = req.body;
  const [r]: any = await pool.query(
    `UPDATE thuong_phat 
     SET nhan_vien_id=?, phong_ban_id=?, loai=?, ly_do=?, so_tien=?, ghi_chu=?
     WHERE id=?`,
    [nhan_vien_id, phong_ban_id, loai, ly_do, so_tien, ghi_chu, id]
  );
  return r.affectedRows > 0;
};

export const remove = async (id: number) => {
  const [r]: any = await pool.query("DELETE FROM thuong_phat WHERE id=?", [id]);
  return r.affectedRows > 0;
};
