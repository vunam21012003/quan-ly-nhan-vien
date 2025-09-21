// src/routes/auth.ts
import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db";
import { requireAuth } from "../middlewares/auth";

// DB: 'admin' | 'manager' | 'nhanvien'
// FE/Token: 'admin' | 'manager' | 'employee'
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

const router = Router();

/**
 * POST /auth/register
 * Body: { username, password, role?, nhan_vien_id? }
 * - role từ FE: 'admin' | 'manager' | 'employee' (mặc định 'employee')
 * - ghi DB: 'admin' | 'manager' | 'nhanvien'
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { username, password, role, nhan_vien_id } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "username, password là bắt buộc" });
    }

    const dbRole = toDbRole(role);
    const hash = await bcrypt.hash(String(password).trim(), 10);

    const sql = `
      INSERT INTO tai_khoan (ten_dang_nhap, mat_khau, quyen, nhan_vien_id)
      VALUES (?, ?, ?, ?)
    `;
    const [result] = await pool.execute(sql, [username, hash, dbRole, nhan_vien_id ?? null]);

    res.status(201).json({ id: (result as any).insertId });
  } catch (err: any) {
    console.error("Register error:", err);
    if (err?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Tên đăng nhập đã tồn tại" });
    }
    res.status(500).json({ error: "Server error", code: err?.code, sqlMessage: err?.sqlMessage });
  }
});

/**
 * POST /auth/login
 * Body: { username, password }
 * Response: { token, user }
 *
 * - Trim password & hash để tránh lỗi khoảng trắng
 * - Chuẩn hoá role DB -> FE
 * - Có log DEBUG nếu set DEBUG_LOGIN=1
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = (req.body || {}) as {
      username?: string;
      password?: string;
    };
    if (!username || !password) {
      return res.status(400).json({ error: "username, password là bắt buộc" });
    }

    if (process.env.DEBUG_LOGIN === "1") {
      const [dbRows]: any = await pool.query("SELECT DATABASE() AS dbname");
      console.log("[DEBUG] DATABASE():", dbRows?.[0]?.dbname);
    }

    const [rows] = await pool.query(
      `SELECT id, ten_dang_nhap, TRIM(mat_khau) AS mat_khau, quyen, nhan_vien_id
       FROM tai_khoan
       WHERE ten_dang_nhap = ?
       LIMIT 1`,
      [username]
    );

    const userRow = (rows as any[])[0];
    if (process.env.DEBUG_LOGIN === "1") {
      console.log("[DEBUG] userRow:", userRow);
    }
    if (!userRow) {
      return res.status(401).json({ error: "Sai tài khoản hoặc mật khẩu" });
    }

    const hash = String(userRow.mat_khau || "").trim();
    const pass = String(password).trim();

    if (process.env.DEBUG_LOGIN === "1") {
      console.log("[DEBUG] hashLen:", hash.length, "hashStart:", hash.slice(0, 4));
    }

    const ok = await bcrypt.compare(pass, hash);

    if (process.env.DEBUG_LOGIN === "1") {
      console.log("[DEBUG] bcrypt.compare:", ok);
    }

    // ❗ Chỉ trả 401 khi SO SÁNH SAI
    if (!ok) {
      return res.status(401).json({ error: "Sai tài khoản hoặc mật khẩu" });
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

    return res.json({ token, user });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /auth/change-password
 * Header: Authorization: Bearer <token>
 * Body: { old_password, new_password }
 */
router.post("/change-password", requireAuth, async (req: Request, res: Response) => {
  try {
    const { old_password, new_password } = req.body || {};
    if (!old_password || !new_password) {
      return res.status(400).json({ error: "old_password, new_password là bắt buộc" });
    }

    const userId = (req as any).user.id as number;

    const [rows] = await pool.query(
      `SELECT TRIM(mat_khau) AS mat_khau FROM tai_khoan WHERE id = ?`,
      [userId]
    );
    const current = (rows as any[])[0]?.mat_khau;
    if (!current) {
      return res.status(404).json({ error: "Tài khoản không tồn tại" });
    }

    const ok = await bcrypt.compare(String(old_password).trim(), String(current).trim());
    if (!ok) {
      return res.status(401).json({ error: "Mật khẩu cũ không đúng" });
    }

    const hash = await bcrypt.hash(String(new_password).trim(), 10);
    await pool.execute(`UPDATE tai_khoan SET mat_khau = ? WHERE id = ?`, [hash, userId]);

    res.json({ ok: true });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /auth/me
 * Header: Authorization: Bearer <token>
 * Response: payload JWT
 */
router.get("/me", requireAuth, (req: Request, res: Response) => {
  res.json((req as any).user);
});

export default router;
