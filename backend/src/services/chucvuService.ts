import { pool } from "../db";

export const getAll = async () => {
  const [rows] = await pool.query(`SELECT id, ten_chuc_vu FROM chuc_vu ORDER BY id DESC`);
  return rows;
};

export const create = async (ten_chuc_vu: string) => {
  const [r]: any = await pool.query(`INSERT INTO chuc_vu (ten_chuc_vu) VALUES (?)`, [ten_chuc_vu]);
  return { id: r.insertId, message: "OK" };
};

export const update = async (id: number, ten_chuc_vu: string | null) => {
  const [r]: any = await pool.query(`UPDATE chuc_vu SET ten_chuc_vu=? WHERE id=?`, [
    ten_chuc_vu,
    id,
  ]);
  return r.affectedRows > 0;
};

export const remove = async (id: number) => {
  const [r]: any = await pool.query(`DELETE FROM chuc_vu WHERE id=?`, [id]);
  return r.affectedRows > 0;
};
