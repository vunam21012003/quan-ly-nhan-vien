// src/routes/taiKhoanRoutes.ts
import { Router } from "express";
import { pool } from "../db";
import bcrypt from "bcryptjs";

const router = Router();

// List
router.get("/", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, username, role, nhan_vien_id, trang_thai, created_at
       FROM tai_khoan ORDER BY id DESC`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Create
router.post("/", async (req, res, next) => {
  try {
    const { username, password, role, nhan_vien_id, trang_thai } =
      req.body || {};
    if (!username || !password)
      return res
        .status(400)
        .json({ message: "username, password là bắt buộc" });

    const password_hash = await bcrypt.hash(String(password), 10);
    const [r]: any = await pool.query(
      `INSERT INTO tai_khoan (username, password_hash, role, nhan_vien_id, trang_thai, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        username,
        password_hash,
        role || "user",
        nhan_vien_id || null,
        trang_thai || "active",
      ]
    );
    res.status(201).json({ id: r.insertId, message: "OK" });
  } catch (e) {
    next(e);
  }
});

// Đổi mật khẩu
router.post("/:id/change-password", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { password } = req.body || {};
    if (!password)
      return res.status(400).json({ message: "password là bắt buộc" });
    const password_hash = await bcrypt.hash(String(password), 10);
    const [r]: any = await pool.query(
      `UPDATE tai_khoan SET password_hash=? WHERE id=?`,
      [password_hash, id]
    );
    if (!r.affectedRows)
      return res.status(404).json({ message: "Không tìm thấy" });
    res.json({ message: "Đã đổi mật khẩu" });
  } catch (e) {
    next(e);
  }
});

// Delete
router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [r]: any = await pool.query(`DELETE FROM tai_khoan WHERE id=?`, [id]);
    if (!r.affectedRows)
      return res.status(404).json({ message: "Không tìm thấy" });
    res.json({ message: "Đã xoá" });
  } catch (e) {
    next(e);
  }
});

export default router;
