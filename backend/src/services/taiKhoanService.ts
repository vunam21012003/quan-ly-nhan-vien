import { pool } from "../db";
import bcrypt from "bcryptjs";

// Map role FE -> DB
function toDbRole(role?: string): "admin" | "manager" | "nhanvien" {
  if (role === "admin") return "admin";
  if (role === "manager") return "manager";
  return "nhanvien";
}

// Map role DB -> FE
function toFeRole(dbRole: string): "admin" | "manager" | "employee" {
  if (dbRole === "admin") return "admin";
  if (dbRole === "manager") return "manager";
  return "employee";
}

export const getAll = async () => {
  const [rows]: any = await pool.query(
    `SELECT id, ten_dang_nhap AS username, quyen AS dbRole, nhan_vien_id FROM tai_khoan ORDER BY id DESC`
  );
  return rows.map((r: any) => ({
    id: r.id,
    username: r.username,
    role: toFeRole(r.dbRole),
    nhan_vien_id: r.nhan_vien_id ?? null,
  }));
};

export const create = async (body: any) => {
  const { username, password, role, nhan_vien_id } = body || {};
  if (!username || !password) {
    return { error: "username, password là bắt buộc" };
  }

  const dbRole = toDbRole(role);
  const hash = await bcrypt.hash(String(password).trim(), 10);

  try {
    const [r]: any = await pool.query(
      `INSERT INTO tai_khoan (ten_dang_nhap, mat_khau, quyen, nhan_vien_id)
       VALUES (?, ?, ?, ?)`,
      [username, hash, dbRole, nhan_vien_id ?? null]
    );
    return { id: r.insertId };
  } catch (e: any) {
    if (e?.code === "ER_DUP_ENTRY") {
      return { errorCode: "DUPLICATE" };
    }
    throw e;
  }
};

export const changePassword = async (id: number, password: string) => {
  const hash = await bcrypt.hash(String(password).trim(), 10);
  const [r]: any = await pool.query(`UPDATE tai_khoan SET mat_khau = ? WHERE id = ?`, [hash, id]);
  return { ok: r.affectedRows > 0 };
};

export const remove = async (id: number) => {
  const [r]: any = await pool.query(`DELETE FROM tai_khoan WHERE id = ?`, [id]);
  return { ok: r.affectedRows > 0 };
};
