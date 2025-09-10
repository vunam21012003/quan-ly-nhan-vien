// src/routes/baoCaoLuongRoutes.ts
import { Router, Request, Response } from "express";
import { pool } from "../db";

const router = Router();

type ParamsWithEmployeeId = { nhan_vien_id: string };

/**
 * GET /bao-cao-luong/luong
 * Query hỗ trợ:
 *  - page, limit (mặc định 1,20)
 *  - thang, nam
 *  - phong_ban_id, chuc_vu_id
 *  - q: tìm theo họ tên nhân viên
 *
 * Trả về:
 *  - lương từng nhân viên trong (thang,nam) + thông tin PB/CV
 *  - có trường tong_luong (tính từ các cột hiện có)
 */
router.get("/luong", async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt(String(req.query.page ?? "1"), 10), 1);
    const limit = Math.max(parseInt(String(req.query.limit ?? "20"), 10), 1);
    const offset = (page - 1) * limit;

    const thang = req.query.thang !== undefined ? parseInt(String(req.query.thang), 10) : undefined;
    const nam = req.query.nam !== undefined ? parseInt(String(req.query.nam), 10) : undefined;

    const phong_ban_id =
      req.query.phong_ban_id !== undefined
        ? parseInt(String(req.query.phong_ban_id), 10)
        : undefined;

    const chuc_vu_id =
      req.query.chuc_vu_id !== undefined ? parseInt(String(req.query.chuc_vu_id), 10) : undefined;

    const q = (req.query.q as string | undefined)?.trim();

    const where: string[] = [];
    const params: any[] = [];

    if (typeof thang === "number" && !Number.isNaN(thang)) {
      where.push("l.thang = ?");
      params.push(thang);
    }
    if (typeof nam === "number" && !Number.isNaN(nam)) {
      where.push("l.nam = ?");
      params.push(nam);
    }
    if (typeof phong_ban_id === "number" && !Number.isNaN(phong_ban_id)) {
      where.push("nv.phong_ban_id = ?");
      params.push(phong_ban_id);
    }
    if (typeof chuc_vu_id === "number" && !Number.isNaN(chuc_vu_id)) {
      where.push("nv.chuc_vu_id = ?");
      params.push(chuc_vu_id);
    }
    if (q && q.length > 0) {
      where.push("nv.ho_ten LIKE ?");
      params.push(`%${q}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countSql = `
      SELECT COUNT(*) AS total
      FROM luong l
      JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
      LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
      LEFT JOIN chuc_vu  cv ON cv.id = nv.chuc_vu_id
      ${whereSql}
    `;
    const [countRows] = await pool.query(countSql, params);
    const total = (countRows as any[])[0]?.total ?? 0;

    const dataSql = `
      SELECT
        l.id,
        l.nhan_vien_id,
        nv.ho_ten,
        pb.ten_phong_ban,
        cv.ten_chuc_vu,
        l.thang,
        l.nam,
        l.luong_co_ban,
        l.phu_cap,
        l.thuong,
        l.khau_tru,
        (COALESCE(l.luong_co_ban,0) + COALESCE(l.phu_cap,0) + COALESCE(l.thuong,0) - COALESCE(l.khau_tru,0)) AS tong_luong
      FROM luong l
      JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
      LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
      LEFT JOIN chuc_vu  cv ON cv.id = nv.chuc_vu_id
      ${whereSql}
      ORDER BY l.nam DESC, l.thang DESC, tong_luong DESC, l.id DESC
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...params, limit, offset];
    const [rows] = await pool.query(dataSql, dataParams);

    res.json({ page, limit, total, items: rows });
  } catch (err: any) {
    console.error("[GET /bao-cao-luong/luong] error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /bao-cao-luong/luong/chi-tiet/:nhan_vien_id
 * Query hỗ trợ:
 *  - thang, nam (tùy chọn): nếu truyền → lọc theo tháng/năm; nếu không → trả toàn bộ lịch sử lương của NV
 */
router.get(
  "/luong/chi-tiet/:nhan_vien_id",
  async (req: Request<ParamsWithEmployeeId>, res: Response) => {
    try {
      const nhan_vien_id = Number(req.params.nhan_vien_id);
      if (!Number.isInteger(nhan_vien_id) || nhan_vien_id <= 0) {
        return res.status(400).json({ error: "nhan_vien_id không hợp lệ" });
      }

      const thang =
        req.query.thang !== undefined ? parseInt(String(req.query.thang), 10) : undefined;
      const nam = req.query.nam !== undefined ? parseInt(String(req.query.nam), 10) : undefined;

      const where: string[] = ["l.nhan_vien_id = ?"];
      const params: any[] = [nhan_vien_id];

      if (typeof thang === "number" && !Number.isNaN(thang)) {
        where.push("l.thang = ?");
        params.push(thang);
      }
      if (typeof nam === "number" && !Number.isNaN(nam)) {
        where.push("l.nam = ?");
        params.push(nam);
      }

      const whereSql = `WHERE ${where.join(" AND ")}`;

      const sql = `
        SELECT
          l.id,
          l.nhan_vien_id,
          nv.ho_ten,
          pb.ten_phong_ban,
          cv.ten_chuc_vu,
          l.thang,
          l.nam,
          l.luong_co_ban,
          l.phu_cap,
          l.thuong,
          l.khau_tru,
          (COALESCE(l.luong_co_ban,0) + COALESCE(l.phu_cap,0) + COALESCE(l.thuong,0) - COALESCE(l.khau_tru,0)) AS tong_luong
        FROM luong l
        JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
        LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
        LEFT JOIN chuc_vu  cv ON cv.id = nv.chuc_vu_id
        ${whereSql}
        ORDER BY l.nam DESC, l.thang DESC, l.id DESC
      `;
      const [rows] = await pool.query(sql, params);

      res.json({ nhan_vien_id, items: rows });
    } catch (err: any) {
      console.error("[GET /bao-cao-luong/luong/chi-tiet/:nhan_vien_id] error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

export default router;
