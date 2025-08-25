// src/routes/hopDongRoutes.ts
import { Router } from "express";
import { pool } from "../db";
const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT hd.*, nv.ho_ten
       FROM hop_dong hd
       JOIN nhan_vien nv ON nv.id = hd.nhan_vien_id
       ORDER BY hd.id DESC`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [rows]: any = await pool.query(
      `SELECT hd.*, nv.ho_ten FROM hop_dong hd
       JOIN nhan_vien nv ON nv.id = hd.nhan_vien_id
       WHERE hd.id=?`,
      [id]
    );
    if (!rows.length)
      return res.status(404).json({ message: "Không tìm thấy" });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const {
      nhan_vien_id,
      so_hop_dong,
      loai_hop_dong,
      ngay_ky,
      ngay_bat_dau,
      ngay_ket_thuc,
      luong_thoa_thuan,
      ghi_chu,
      trang_thai,
    } = req.body || {};
    if (!nhan_vien_id || !so_hop_dong)
      return res
        .status(400)
        .json({ message: "nhan_vien_id, so_hop_dong là bắt buộc" });

    const [r]: any = await pool.query(
      `INSERT INTO hop_dong
       (nhan_vien_id, so_hop_dong, loai_hop_dong, ngay_ky, ngay_bat_dau, ngay_ket_thuc,
        luong_thoa_thuan, ghi_chu, trang_thai)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nhan_vien_id,
        so_hop_dong,
        loai_hop_dong || null,
        ngay_ky || null,
        ngay_bat_dau || null,
        ngay_ket_thuc || null,
        luong_thoa_thuan || 0,
        ghi_chu || null,
        trang_thai || null,
      ]
    );
    res.status(201).json({ id: r.insertId, message: "OK" });
  } catch (e) {
    next(e);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const {
      nhan_vien_id,
      so_hop_dong,
      loai_hop_dong,
      ngay_ky,
      ngay_bat_dau,
      ngay_ket_thuc,
      luong_thoa_thuan,
      ghi_chu,
      trang_thai,
    } = req.body || {};
    const [r]: any = await pool.query(
      `UPDATE hop_dong SET
        nhan_vien_id=?, so_hop_dong=?, loai_hop_dong=?, ngay_ky=?, ngay_bat_dau=?, ngay_ket_thuc=?,
        luong_thoa_thuan=?, ghi_chu=?, trang_thai=?
       WHERE id=?`,
      [
        nhan_vien_id || null,
        so_hop_dong || null,
        loai_hop_dong || null,
        ngay_ky || null,
        ngay_bat_dau || null,
        ngay_ket_thuc || null,
        luong_thoa_thuan || 0,
        ghi_chu || null,
        trang_thai || null,
        id,
      ]
    );
    if (!r.affectedRows)
      return res.status(404).json({ message: "Không tìm thấy" });
    res.json({ message: "Đã cập nhật" });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [r]: any = await pool.query(`DELETE FROM hop_dong WHERE id=?`, [id]);
    if (!r.affectedRows)
      return res.status(404).json({ message: "Không tìm thấy" });
    res.json({ message: "Đã xoá" });
  } catch (e) {
    next(e);
  }
});

export default router;
