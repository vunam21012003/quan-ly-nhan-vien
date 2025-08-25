// src/routes/chamCongRoutes.ts
import { Router } from "express";
import { pool } from "../db";
const router = Router();

// list theo tháng/năm + nhân viên (tuỳ chọn)
router.get("/", async (req, res, next) => {
  try {
    const thang = Number(req.query.thang) || null;
    const nam = Number(req.query.nam) || null;
    const nhan_vien_id = Number(req.query.nhan_vien_id) || null;

    let where = "WHERE 1=1";
    const params: any[] = [];
    if (thang && nam) {
      where += " AND MONTH(cc.ngay)=? AND YEAR(cc.ngay)=?";
      params.push(thang, nam);
    }
    if (nhan_vien_id) {
      where += " AND cc.nhan_vien_id=?";
      params.push(nhan_vien_id);
    }

    const [rows] = await pool.query(
      `
      SELECT cc.id, cc.nhan_vien_id, nv.ho_ten, cc.ngay, cc.check_in, cc.check_out,
             cc.ghi_chu, cc.trang_thai
      FROM cham_cong cc
      JOIN nhan_vien nv ON nv.id = cc.nhan_vien_id
      ${where}
      ORDER BY cc.ngay DESC, cc.id DESC
      `,
      params
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { nhan_vien_id, ngay, check_in, check_out, ghi_chu, trang_thai } =
      req.body || {};
    if (!nhan_vien_id || !ngay)
      return res
        .status(400)
        .json({ message: "nhan_vien_id và ngay là bắt buộc" });

    const [r]: any = await pool.query(
      `INSERT INTO cham_cong (nhan_vien_id, ngay, check_in, check_out, ghi_chu, trang_thai)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        nhan_vien_id,
        ngay,
        check_in || null,
        check_out || null,
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
    const { nhan_vien_id, ngay, check_in, check_out, ghi_chu, trang_thai } =
      req.body || {};
    const [r]: any = await pool.query(
      `UPDATE cham_cong
       SET nhan_vien_id=?, ngay=?, check_in=?, check_out=?, ghi_chu=?, trang_thai=?
       WHERE id=?`,
      [
        nhan_vien_id || null,
        ngay || null,
        check_in || null,
        check_out || null,
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
    const [r]: any = await pool.query(`DELETE FROM cham_cong WHERE id=?`, [id]);
    if (!r.affectedRows)
      return res.status(404).json({ message: "Không tìm thấy" });
    res.json({ message: "Đã xoá" });
  } catch (e) {
    next(e);
  }
});

export default router;
