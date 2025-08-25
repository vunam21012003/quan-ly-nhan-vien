// src/routes/luongRoutes.ts
import { Router } from "express";
import { pool } from "../db";
const router = Router();

// Liệt kê bảng lương theo tháng/năm
router.get("/", async (req, res, next) => {
  try {
    const thang = Number(req.query.thang);
    const nam = Number(req.query.nam);
    let where = "WHERE 1=1";
    const params: any[] = [];
    if (thang) {
      where += " AND l.thang=?";
      params.push(thang);
    }
    if (nam) {
      where += " AND l.nam=?";
      params.push(nam);
    }

    const [rows] = await pool.query(
      `SELECT l.*, nv.ho_ten
       FROM luong l
       JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
       ${where}
       ORDER BY l.nam DESC, l.thang DESC, l.id DESC`,
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
      luong_co_ban,
      phu_cap,
      thuong,
      phat,
      gio_tang_ca,
      luong_thuc_nhan,
      ghi_chu,
    } = req.body || {};
    if (!nhan_vien_id || !thang || !nam)
      return res
        .status(400)
        .json({ message: "nhan_vien_id, thang, nam là bắt buộc" });

    const [r]: any = await pool.query(
      `INSERT INTO luong
       (nhan_vien_id, thang, nam, luong_co_ban, phu_cap, thuong, phat, gio_tang_ca, luong_thuc_nhan, ghi_chu)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nhan_vien_id,
        thang,
        nam,
        luong_co_ban || 0,
        phu_cap || 0,
        thuong || 0,
        phat || 0,
        gio_tang_ca || 0,
        luong_thuc_nhan || 0,
        ghi_chu || null,
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
      thang,
      nam,
      luong_co_ban,
      phu_cap,
      thuong,
      phat,
      gio_tang_ca,
      luong_thuc_nhan,
      ghi_chu,
    } = req.body || {};

    const [r]: any = await pool.query(
      `UPDATE luong SET
       nhan_vien_id=?, thang=?, nam=?, luong_co_ban=?, phu_cap=?, thuong=?, phat=?,
       gio_tang_ca=?, luong_thuc_nhan=?, ghi_chu=? WHERE id=?`,
      [
        nhan_vien_id || null,
        thang || null,
        nam || null,
        luong_co_ban || 0,
        phu_cap || 0,
        thuong || 0,
        phat || 0,
        gio_tang_ca || 0,
        luong_thuc_nhan || 0,
        ghi_chu || null,
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
    const [r]: any = await pool.query(`DELETE FROM luong WHERE id=?`, [id]);
    if (!r.affectedRows)
      return res.status(404).json({ message: "Không tìm thấy" });
    res.json({ message: "Đã xoá" });
  } catch (e) {
    next(e);
  }
});

export default router;
