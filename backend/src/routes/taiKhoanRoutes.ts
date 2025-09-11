// src/routes/taiKhoanRoutes.ts
import { Router } from "express";
import { pool } from "../db";
import bcrypt from "bcryptjs";

const router = Router();

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

/**
 * GET /tai-khoan
 * Danh sách tài khoản
 */
router.get("/", async (_req, res, next) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT id,
              ten_dang_nhap AS username,
              quyen         AS dbRole,
              nhan_vien_id
       FROM tai_khoan
       ORDER BY id DESC`
    );

    // Chuẩn hoá role DB -> FE
    const data = rows.map((r: any) => ({
      id: r.id,
      username: r.username,
      role: toFeRole(r.dbRole),
      nhan_vien_id: r.nhan_vien_id ?? null,
    }));

    res.json(data);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /tai-khoan
 * Body: { username, password, role?, nhan_vien_id? }
 */
router.post("/", async (req, res, next) => {
  try {
    const { username, password, role, nhan_vien_id } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: "username, password là bắt buộc" });
    }

    const dbRole = toDbRole(role);
    const hash = await bcrypt.hash(String(password).trim(), 10);

    const [r]: any = await pool.query(
      `INSERT INTO tai_khoan (ten_dang_nhap, mat_khau, quyen, nhan_vien_id)
       VALUES (?, ?, ?, ?)`,
      [username, hash, dbRole, nhan_vien_id ?? null]
    );

    res.status(201).json({ id: r.insertId, message: "OK" });
  } catch (e: any) {
    if (e?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Tên đăng nhập đã tồn tại" });
    }
    next(e);
  }
});

/**
 * POST /tai-khoan/:id/change-password
 * Body: { password }
 */
router.post("/:id/change-password", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ message: "password là bắt buộc" });

    const hash = await bcrypt.hash(String(password).trim(), 10);

    const [r]: any = await pool.query(`UPDATE tai_khoan SET mat_khau = ? WHERE id = ?`, [hash, id]);
    if (!r.affectedRows) return res.status(404).json({ message: "Không tìm thấy" });

    res.json({ message: "Đã đổi mật khẩu" });
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /tai-khoan/:id
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [r]: any = await pool.query(`DELETE FROM tai_khoan WHERE id = ?`, [id]);
    if (!r.affectedRows) return res.status(404).json({ message: "Không tìm thấy" });

    res.json({ message: "Đã xoá" });
  } catch (e) {
    next(e);
  }
});

export default router;
