// src/routes/auth.ts
import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db";
import { requireAuth } from "../middlewares/auth";

// Map role trong DB -> role trong token
// DB: 'admin' | 'manager' | 'nhanvien'
// Token: 'admin' | 'manager' | 'employee'
function normalizeRole(dbRole: string): "admin" | "manager" | "employee" {
  if (dbRole === "admin") return "admin";
  if (dbRole === "manager") return "manager";
  return "employee";
}

// Map role ở body -> role trong DB
function toDbRole(role?: string): "admin" | "manager" | "nhanvien" {
  if (role === "admin") return "admin";
  if (role === "manager") return "manager";
  return "nhanvien";
}

const router = Router();

/**
 * POST /auth/register
 * Body: { username, password, role?, nhan_vien_id? }
 * - role chấp nhận: 'admin' | 'manager' | 'employee' (mặc định 'employee')
 * - ghi DB: 'admin' | 'manager' | 'nhanvien'
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { username, password, role, nhan_vien_id } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "username, password là bắt buộc" });
    }

    const dbRole = toDbRole(role);
    const hash = await bcrypt.hash(password, 10);

    const sql = `
      INSERT INTO tai_khoan (ten_dang_nhap, mat_khau, quyen, nhan_vien_id)
      VALUES (?, ?, ?, ?)
    `;
    const [result] = await pool.execute(sql, [username, hash, dbRole, nhan_vien_id ?? null]);

    res.status(201).json({ id: (result as any).insertId });
  } catch (err: any) {
    console.error("Register error:", err);
    // Bắt lỗi trùng username (UNIQUE)
    if (err?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Tên đăng nhập đã tồn tại" });
    }
    res.status(500).json({
      error: "Server error",
      code: err?.code,
      sqlMessage: err?.sqlMessage,
    });
  }
});

/**
 * POST /auth/login
 * Body: { username, password }
 * Response: { token }
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "username, password là bắt buộc" });
    }

    const [rows] = await pool.query(
      `SELECT id, ten_dang_nhap, mat_khau, quyen
       FROM tai_khoan
       WHERE ten_dang_nhap = ?`,
      [username]
    );
    const user = (rows as any[])[0];
    if (!user) {
      return res.status(401).json({ error: "Sai tài khoản hoặc mật khẩu" });
    }

    const ok = await bcrypt.compare(password, user.mat_khau);
    if (!ok) {
      return res.status(401).json({ error: "Sai tài khoản hoặc mật khẩu" });
    }

    const role = normalizeRole(user.quyen);
    const token = jwt.sign(
      { id: user.id, role, username: user.ten_dang_nhap },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    res.json({ token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
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

    const [rows] = await pool.query(`SELECT mat_khau FROM tai_khoan WHERE id = ?`, [userId]);
    const current = (rows as any[])[0]?.mat_khau;
    if (!current) {
      return res.status(404).json({ error: "Tài khoản không tồn tại" });
    }

    const ok = await bcrypt.compare(old_password, current);
    if (!ok) {
      return res.status(401).json({ error: "Mật khẩu cũ không đúng" });
    }

    const hash = await bcrypt.hash(new_password, 10);
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
 * Response: { id, username, role, iat, exp }
 * -> trả thẳng payload của JWT để FE biết user đang đăng nhập
 */
router.get("/me", requireAuth, (req: Request, res: Response) => {
  res.json((req as any).user);
});

export default router;
