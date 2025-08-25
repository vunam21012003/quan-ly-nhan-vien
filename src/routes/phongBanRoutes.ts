import { Router } from "express";
import { pool } from "../db";
const router = Router();

// List
router.get("/", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, ten_phong_ban FROM phong_ban ORDER BY id DESC`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Create
router.post("/", async (req, res, next) => {
  try {
    const { ten_phong_ban } = req.body || {};
    if (!ten_phong_ban)
      return res.status(400).json({ message: "ten_phong_ban là bắt buộc" });
    const [r]: any = await pool.query(
      `INSERT INTO phong_ban (ten_phong_ban) VALUES (?)`,
      [ten_phong_ban]
    );
    res.status(201).json({ id: r.insertId, message: "OK" });
  } catch (e) {
    next(e);
  }
});

// Update
router.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { ten_phong_ban } = req.body || {};
    const [r]: any = await pool.query(
      `UPDATE phong_ban SET ten_phong_ban=? WHERE id=?`,
      [ten_phong_ban || null, id]
    );
    if (r.affectedRows === 0)
      return res.status(404).json({ message: "Không tìm thấy" });
    res.json({ message: "OK" });
  } catch (e) {
    next(e);
  }
});

// Delete
router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [r]: any = await pool.query(`DELETE FROM phong_ban WHERE id=?`, [id]);
    if (r.affectedRows === 0)
      return res.status(404).json({ message: "Không tìm thấy" });
    res.json({ message: "Đã xoá" });
  } catch (e) {
    next(e);
  }
});

export default router;
