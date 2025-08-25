// src/routes/phanTichCongRoutes.ts
import { Router } from "express";
import { pool } from "../db";
const router = Router();

// GET theo tháng/năm/+nhân viên
router.get("/", async (req, res, next) => {
  try {
    const thang = Number(req.query.thang);
    const nam = Number(req.query.nam);
    const nhan_vien_id = Number(req.query.nhan_vien_id) || null;

    let where = "WHERE 1=1";
    const params: any[] = [];
    if (thang) {
      where += " AND pt.thang=?";
      params.push(thang);
    }
    if (nam) {
      where += " AND pt.nam=?";
      params.push(nam);
    }
    if (nhan_vien_id) {
      where += " AND pt.nhan_vien_id=?";
      params.push(nhan_vien_id);
    }

    const [rows] = await pool.query(
      `SELECT pt.*, nv.ho_ten
       FROM phan_tich_cong pt
       JOIN nhan_vien nv ON nv.id = pt.nhan_vien_id
       ${where}
       ORDER BY pt.nam DESC, pt.thang DESC, pt.id DESC`,
      params
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const {
      nhan_vien_id,
      thang,
      nam,
      tong_gio,
      gio_ngay_thuong,
      gio_ngay_nghi,
      gio_tang_ca,
      so_ngay_cong,
      so_ngay_nghi,
      ghi_chu,
    } = req.body || {};
    if (!nhan_vien_id || !thang || !nam)
      return res
        .status(400)
        .json({ message: "nhan_vien_id, thang, nam là bắt buộc" });

    const [r]: any = await pool.query(
      `INSERT INTO phan_tich_cong
       (nhan_vien_id, thang, nam, tong_gio, gio_ngay_thuong, gio_ngay_nghi, gio_tang_ca, so_ngay_cong, so_ngay_nghi, ghi_chu)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nhan_vien_id,
        thang,
        nam,
        tong_gio || 0,
        gio_ngay_thuong || 0,
        gio_ngay_nghi || 0,
        gio_tang_ca || 0,
        so_ngay_cong || 0,
        so_ngay_nghi || 0,
        ghi_chu || null,
      ]
    );
    res.status(201).json({ id: r.insertId, message: "OK" });
  } catch (e) {
    next(e);
  }
});

export default router;
