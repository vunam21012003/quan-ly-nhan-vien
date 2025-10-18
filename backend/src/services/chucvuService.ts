import { pool } from "../db";

export const getAll = async (search: string, page: number, limit: number) => {
  const offset = (page - 1) * limit;

  let where = "";
  const params: any[] = [];
  if (search) {
    where = "WHERE ten_chuc_vu LIKE ?";
    params.push(`%${search}%`);
  }

  // lấy danh sách có phân trang
  const [rows] = await pool.query(
    `SELECT id, ten_chuc_vu, mo_ta
     FROM chuc_vu
     ${where}
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  // tổng số bản ghi
  const [[{ total }]]: any = await pool.query(
    `SELECT COUNT(*) as total FROM chuc_vu ${where}`,
    params
  );

  return { items: rows, total };
};

export const create = async (ten_chuc_vu: string, mo_ta: string | null) => {
  const [r]: any = await pool.query(`INSERT INTO chuc_vu (ten_chuc_vu, mo_ta) VALUES (?, ?)`, [
    ten_chuc_vu,
    mo_ta,
  ]);
  return { id: r.insertId, message: "OK" };
};

export const update = async (id: number, ten_chuc_vu: string | null, mo_ta: string | null) => {
  const [r]: any = await pool.query(`UPDATE chuc_vu SET ten_chuc_vu=?, mo_ta=? WHERE id=?`, [
    ten_chuc_vu,
    mo_ta,
    id,
  ]);
  return r.affectedRows > 0;
};

export const remove = async (id: number) => {
  const [r]: any = await pool.query(`DELETE FROM chuc_vu WHERE id=?`, [id]);
  return r.affectedRows > 0;
};
