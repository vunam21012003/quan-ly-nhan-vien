import { Router } from "express";
import { pool } from "../db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

// READ
router.get(
  "/",
  requireAuth,
  requireRole(["admin", "manager", "employee"]),
  async (_req, res, next) => {
    try {
      const [rows] = await pool.query(`SELECT id, ten_chuc_vu FROM chuc_vu ORDER BY id DESC`);
      res.json(rows);
    } catch (e) {
      next(e);
    }
  }
);

// CREATE: admin
router.post("/", requireAuth, requireRole(["admin"]), async (req, res, next) => {
  try {
    const { ten_chuc_vu } = req.body || {};
    if (!ten_chuc_vu) return res.status(400).json({ message: "ten_chuc_vu là bắt buộc" });

    const [r]: any = await pool.query(`INSERT INTO chuc_vu (ten_chuc_vu) VALUES (?)`, [
      ten_chuc_vu,
    ]);
    res.status(201).json({ id: r.insertId, message: "OK" });
  } catch (e) {
    next(e);
  }
});

// UPDATE: admin
router.put("/:id", requireAuth, requireRole(["admin"]), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { ten_chuc_vu } = req.body || {};

    const [r]: any = await pool.query(`UPDATE chuc_vu SET ten_chuc_vu=? WHERE id=?`, [
      ten_chuc_vu || null,
      id,
    ]);
    if (r.affectedRows === 0) return res.status(404).json({ message: "Không tìm thấy" });

    res.json({ message: "OK" });
  } catch (e) {
    next(e);
  }
});

// DELETE: admin
router.delete("/:id", requireAuth, requireRole(["admin"]), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [r]: any = await pool.query(`DELETE FROM chuc_vu WHERE id=?`, [id]);
    if (r.affectedRows === 0) return res.status(404).json({ message: "Không tìm thấy" });

    res.json({ message: "Đã xoá" });
  } catch (e) {
    next(e);
  }
});

export default router;
