import { pool } from "../db";

export const getAll = async () => {
  const [rows] = await pool.query(`SELECT id, ten_phong_ban FROM phong_ban ORDER BY id DESC`);
  return rows;
};

export const create = async (ten_phong_ban: string) => {
  const [r]: any = await pool.query(`INSERT INTO phong_ban (ten_phong_ban) VALUES (?)`, [
    ten_phong_ban,
  ]);
  return { id: r.insertId };
};

export const update = async (id: number, ten_phong_ban: string) => {
  const [r]: any = await pool.query(`UPDATE phong_ban SET ten_phong_ban = ? WHERE id = ?`, [
    ten_phong_ban || null,
    id,
  ]);
  return { ok: r.affectedRows > 0 };
};

export const remove = async (id: number) => {
  const [r]: any = await pool.query(`DELETE FROM phong_ban WHERE id = ?`, [id]);
  return { ok: r.affectedRows > 0 };
};
