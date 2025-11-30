//phuCapLoaiService
import { pool } from "../db";

export const list = async () => {
  const [rows] = await pool.query(
    "SELECT id, ten, mo_ta, tinh_bhxh, mac_dinh, is_fixed FROM phu_cap_loai ORDER BY id DESC"
  );
  return rows;
};

export const create = async (body: any) => {
  const { ten, mo_ta, tinh_bhxh, mac_dinh, is_fixed } = body;

  const [r]: any = await pool.query(
    `INSERT INTO phu_cap_loai (ten, mo_ta, tinh_bhxh, mac_dinh, is_fixed)
     VALUES (?, ?, ?, ?, ?)`,
    [ten, mo_ta, tinh_bhxh, mac_dinh, is_fixed]
  );
  return { id: r.insertId };
};

export const update = async (id: number, body: any) => {
  const { ten, mo_ta, tinh_bhxh, mac_dinh, is_fixed } = body;

  await pool.query(
    `UPDATE phu_cap_loai 
     SET ten=?, mo_ta=?, tinh_bhxh=?, mac_dinh=?, is_fixed=? 
     WHERE id=?`,
    [ten, mo_ta, tinh_bhxh, mac_dinh, is_fixed, id]
  );

  return { ok: true };
};

export const remove = async (id: number) => {
  await pool.query("DELETE FROM phu_cap_chi_tiet WHERE loai_id=?", [id]);
  await pool.query("DELETE FROM phu_cap_loai WHERE id=?", [id]);
  return { ok: true };
};
