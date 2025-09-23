import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db";

function normalizeRole(dbRole: string): "admin" | "manager" | "employee" {
  if (dbRole === "admin") return "admin";
  if (dbRole === "manager") return "manager";
  return "employee";
}

function toDbRole(role?: string): "admin" | "manager" | "nhanvien" {
  if (role === "admin") return "admin";
  if (role === "manager") return "manager";
  return "nhanvien";
}

export const register = async (body: any) => {
  try {
    const { username, password, role, nhan_vien_id } = body || {};
    if (!username || !password) {
      return { error: "username, password là bắt buộc", status: 400 };
    }

    const dbRole = toDbRole(role);
    const hash = await bcrypt.hash(String(password).trim(), 10);

    const sql = `
      INSERT INTO tai_khoan (ten_dang_nhap, mat_khau, quyen, nhan_vien_id)
      VALUES (?, ?, ?, ?)
    `;
    const [result] = await pool.execute(sql, [username, hash, dbRole, nhan_vien_id ?? null]);
    return { data: { id: (result as any).insertId } };
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") {
      return { error: "Tên đăng nhập đã tồn tại", status: 409 };
    }
    console.error("Register error:", err);
    return { error: "Server error", status: 500 };
  }
};

export const login = async (body: any) => {
  try {
    const { username, password } = body || {};
    if (!username || !password) {
      return { error: "username, password là bắt buộc", status: 400 };
    }

    const [rows] = await pool.query(
      `SELECT id, ten_dang_nhap, TRIM(mat_khau) AS mat_khau, quyen, nhan_vien_id
       FROM tai_khoan
       WHERE ten_dang_nhap = ?
       LIMIT 1`,
      [username]
    );
    const userRow = (rows as any[])[0];
    if (!userRow) {
      return { error: "Sai tài khoản hoặc mật khẩu", status: 401 };
    }

    const hash = String(userRow.mat_khau || "").trim();
    const pass = String(password).trim();
    const ok = await bcrypt.compare(pass, hash);
    if (!ok) {
      return { error: "Sai tài khoản hoặc mật khẩu", status: 401 };
    }

    const role = normalizeRole(userRow.quyen);
    const secret = process.env.JWT_SECRET || "dev_secret_change_me";
    const token = jwt.sign({ id: userRow.id, role, username: userRow.ten_dang_nhap }, secret, {
      expiresIn: "7d",
    });

    const user = {
      id: userRow.id,
      username: userRow.ten_dang_nhap,
      role,
      nhan_vien_id: userRow.nhan_vien_id ?? null,
    };

    return { data: { token, user } };
  } catch (err) {
    console.error("Login error:", err);
    return { error: "Server error", status: 500 };
  }
};

export const changePassword = async (userId: number, body: any) => {
  try {
    const { old_password, new_password } = body || {};
    if (!old_password || !new_password) {
      return { error: "old_password, new_password là bắt buộc", status: 400 };
    }

    const [rows] = await pool.query(
      `SELECT TRIM(mat_khau) AS mat_khau FROM tai_khoan WHERE id = ?`,
      [userId]
    );
    const current = (rows as any[])[0]?.mat_khau;
    if (!current) {
      return { error: "Tài khoản không tồn tại", status: 404 };
    }

    const ok = await bcrypt.compare(String(old_password).trim(), String(current).trim());
    if (!ok) {
      return { error: "Mật khẩu cũ không đúng", status: 401 };
    }

    const hash = await bcrypt.hash(String(new_password).trim(), 10);
    await pool.execute(`UPDATE tai_khoan SET mat_khau = ? WHERE id = ?`, [hash, userId]);

    return { data: { ok: true } };
  } catch (err) {
    console.error("Change password error:", err);
    return { error: "Server error", status: 500 };
  }
};
