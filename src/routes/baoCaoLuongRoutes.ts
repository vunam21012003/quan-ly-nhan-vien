// src/routes/reportsRoutes.ts
import { Router } from "express";
import { pool } from "../db";
const router = Router();

/** GET /reports/luong?thang=8&nam=2025&q=keyword */
router.get("/luong", async (req, res, next) => {
  try {
    const thang = Number(req.query.thang);
    const nam = Number(req.query.nam);
    const q = String(req.query.q || "").trim();
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
    if (q) {
      where += " AND (nv.ho_ten LIKE ? OR nv.email LIKE ?)";
      params.push(`%${q}%`, `%${q}%`);
    }

    const [rows] = await pool.query(
      `SELECT l.id, l.thang, l.nam, nv.id AS nhan_vien_id, nv.ho_ten,
              l.luong_co_ban, l.phu_cap, l.thuong, l.phat, l.gio_tang_ca, l.luong_thuc_nhan,
              pb.ten_phong_ban, cv.ten_chuc_vu
       FROM luong l
       JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
       LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
       LEFT JOIN chuc_vu  cv ON cv.id = nv.chuc_vu_id
       ${where}
       ORDER BY l.nam DESC, l.thang DESC, l.id DESC`,
      params
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

export default router;
