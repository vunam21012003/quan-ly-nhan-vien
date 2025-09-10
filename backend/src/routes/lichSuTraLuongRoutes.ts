// src/routes/lichSuTraLuongRoutes.ts
import { Router, Request, Response } from "express";
import { pool } from "../db";

const router = Router();

type ParamsWithId = { id: string };

/**
 * GET /lich-su-tra-luong
 * Query:
 *  - page, limit (mặc định 1,20)
 *  - thang, nam
 *  - nhan_vien_id
 *  - tu_ngay, den_ngay (lọc theo ngày_tra, định dạng YYYY-MM-DD)
 *  - q: tìm theo họ tên nhân viên
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt(String(req.query.page ?? "1"), 10), 1);
    const limit = Math.max(parseInt(String(req.query.limit ?? "20"), 10), 1);
    const offset = (page - 1) * limit;

    const thang = req.query.thang !== undefined ? parseInt(String(req.query.thang), 10) : undefined;
    const nam = req.query.nam !== undefined ? parseInt(String(req.query.nam), 10) : undefined;
    const nhan_vien_id =
      req.query.nhan_vien_id !== undefined
        ? parseInt(String(req.query.nhan_vien_id), 10)
        : undefined;

    const tu_ngay = (req.query.tu_ngay as string | undefined)?.trim(); // YYYY-MM-DD
    const den_ngay = (req.query.den_ngay as string | undefined)?.trim(); // YYYY-MM-DD

    const q = (req.query.q as string | undefined)?.trim();

    const where: string[] = [];
    const params: any[] = [];

    if (typeof thang === "number" && !Number.isNaN(thang)) {
      where.push("ls.thang = ?");
      params.push(thang);
    }
    if (typeof nam === "number" && !Number.isNaN(nam)) {
      where.push("ls.nam = ?");
      params.push(nam);
    }
    if (typeof nhan_vien_id === "number" && !Number.isNaN(nhan_vien_id)) {
      where.push("ls.nhan_vien_id = ?");
      params.push(nhan_vien_id);
    }
    if (tu_ngay) {
      where.push("ls.ngay_tra >= ?");
      params.push(tu_ngay);
    }
    if (den_ngay) {
      where.push("ls.ngay_tra <= ?");
      params.push(den_ngay);
    }
    if (q && q.length > 0) {
      where.push("nv.ho_ten LIKE ?");
      params.push(`%${q}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countSql = `
      SELECT COUNT(*) AS total
      FROM lich_su_tra_luong ls
      JOIN nhan_vien nv ON nv.id = ls.nhan_vien_id
      ${whereSql}
    `;
    const [countRows] = await pool.query(countSql, params);
    const total = (countRows as any[])[0]?.total ?? 0;

    const dataSql = `
      SELECT
        ls.id,
        ls.nhan_vien_id,
        nv.ho_ten,
        ls.thang,
        ls.nam,
        ls.tong_luong,
        ls.ngay_tra
      FROM lich_su_tra_luong ls
      JOIN nhan_vien nv ON nv.id = ls.nhan_vien_id
      ${whereSql}
      ORDER BY ls.ngay_tra DESC, ls.nam DESC, ls.thang DESC, ls.id DESC
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...params, limit, offset];
    const [rows] = await pool.query(dataSql, dataParams);

    res.json({ page, limit, total, items: rows });
  } catch (err: any) {
    console.error("[GET /lich-su-tra-luong] error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /lich-su-tra-luong
 * Body bắt buộc:
 *  - nhan_vien_id (number)
 *  - thang (1..12)
 *  - nam (VD 2025)
 *  - tong_luong (number)
 *  - ngay_tra ('YYYY-MM-DD' hoặc 'YYYY-MM-DD HH:mm:ss')
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { nhan_vien_id, thang, nam, tong_luong, ngay_tra } = req.body || {};
    if (!nhan_vien_id || !thang || !nam || tong_luong === undefined || !ngay_tra) {
      return res.status(400).json({
        error: "nhan_vien_id, thang, nam, tong_luong, ngay_tra là bắt buộc",
      });
    }

    const sql = `
      INSERT INTO lich_su_tra_luong
        (nhan_vien_id, thang, nam, tong_luong, ngay_tra)
      VALUES
        (?, ?, ?, ?, ?)
    `;
    const [result] = await pool.execute(sql, [nhan_vien_id, thang, nam, tong_luong, ngay_tra]);

    res.status(201).json({ id: (result as any).insertId });
  } catch (err: any) {
    console.error("[POST /lich-su-tra-luong] error:", {
      code: err?.code,
      errno: err?.errno,
      sqlMessage: err?.sqlMessage,
      sql: err?.sql,
    });
    res.status(500).json({ error: "Server error", code: err?.code, sqlMessage: err?.sqlMessage });
  }
});

/**
 * PUT /lich-su-tra-luong/:id
 * Body: nhan_vien_id?, thang?, nam?, tong_luong?, ngay_tra?
 */
router.put("/:id", async (req: Request<ParamsWithId>, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "id không hợp lệ" });
    }

    const allowed = ["nhan_vien_id", "thang", "nam", "tong_luong", "ngay_tra"] as const;
    const fields = allowed.filter((k) => req.body?.[k] !== undefined);
    if (!fields.length) {
      return res.status(400).json({ error: "Không có trường nào để cập nhật" });
    }

    const sets = fields.map((k) => `${k} = ?`).join(", ");
    const values = fields.map((k) => req.body[k]);

    const sql = `UPDATE lich_su_tra_luong SET ${sets} WHERE id = ?`;
    await pool.execute(sql, [...values, id]);

    res.json({ ok: true });
  } catch (err: any) {
    console.error("[PUT /lich-su-tra-luong/:id] error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * DELETE /lich-su-tra-luong/:id
 */
router.delete("/:id", async (req: Request<ParamsWithId>, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "id không hợp lệ" });
    }

    await pool.execute("DELETE FROM lich_su_tra_luong WHERE id = ?", [id]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[DELETE /lich-su-tra-luong/:id] error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
