// src/routes/lichSuTraLuongRoutes.ts
import { Router } from "express";
import { pool } from "../db";
const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT ls.*, nv.ho_ten
       FROM lich_su_tra_luong ls
       JOIN nhan_vien nv ON nv.id = ls.nhan_vien_id
       ORDER BY ls.ngay_tra DESC, ls.id DESC`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { nhan_vien_id, ky_tra, so_tien, ngay_tra, phuong_thuc, ghi_chu } =
      req.body || {};
    if (!nhan_vien_id || !so_tien || !ngay_tra)
      return res
        .status(400)
        .json({ message: "nhan_vien_id, so_tien, ngay_tra là bắt buộc" });

    const [r]: any = await pool.query(
      `INSERT INTO lich_su_tra_luong (nhan_vien_id, ky_tra, so_tien, ngay_tra, phuong_thuc, ghi_chu)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        nhan_vien_id,
        ky_tra || null,
        so_tien,
        ngay_tra,
        phuong_thuc || null,
        ghi_chu || null,
      ]
    );
    res.status(201).json({ id: r.insertId, message: "OK" });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [r]: any = await pool.query(
      `DELETE FROM lich_su_tra_luong WHERE id=?`,
      [id]
    );
    if (!r.affectedRows)
      return res.status(404).json({ message: "Không tìm thấy" });
    res.json({ message: "Đã xoá" });
  } catch (e) {
    next(e);
  }
});

export default router;
