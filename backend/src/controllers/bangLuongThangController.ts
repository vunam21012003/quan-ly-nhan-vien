// src/controllers/bangLuongThangController.ts
import { Request, Response } from "express";
import { pool } from "../db";
import { tinhLuongThang } from "../services/tinhLuongService";

/**
 * Lấy danh sách kỳ lương đã tạo
 */
export const list = async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(`
      SELECT bl.*, u.ho_ten AS nguoi_tinh
      FROM bang_luong_thang bl
      LEFT JOIN nhan_vien u ON bl.nguoi_tinh_id = u.id
      ORDER BY nam DESC, thang DESC
    `);
    res.json({ items: rows });
  } catch (err) {
    console.error("GET /bang-luong-thang error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Tạo mới kỳ lương hoặc tính lại lương cho tháng/năm
 */
export const createOrRecalc = async (req: Request, res: Response) => {
  try {
    const { thang, nam } = req.body;
    if (!thang || !nam) {
      return res.status(400).json({ message: "Thiếu tháng hoặc năm" });
    }

    // 1️⃣ Tính toán lương theo 3P (P1, P2, P3)
    const result = await tinhLuongThang(thang, nam, req);

    // 2️⃣ Nếu chưa tồn tại kỳ lương -> thêm mới
    await pool.query(
      `INSERT INTO bang_luong_thang (thang, nam, nguoi_tinh_id, trang_thai, ngay_tinh)
       VALUES (?, ?, ?, 'DA_CHOT', NOW())
       ON DUPLICATE KEY UPDATE trang_thai='DA_CHOT', ngay_tinh=NOW()`,
      [thang, nam, (req as any).user?.id || null]
    );

    res.json({
      message: `✅ Đã tính lương tháng ${thang}/${nam} cho ${result.totalNhanVien} nhân viên.`,
      summary: result.summary,
    });
  } catch (err) {
    console.error("POST /bang-luong-thang error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Xem chi tiết kỳ lương cụ thể
 */
export const detail = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [[record]]: any = await pool.query(`SELECT * FROM bang_luong_thang WHERE id = ?`, [id]);
    if (!record) return res.status(404).json({ message: "Không tìm thấy kỳ lương" });

    const [rows]: any = await pool.query(`SELECT * FROM luong WHERE thang = ? AND nam = ?`, [
      record.thang,
      record.nam,
    ]);

    res.json({ bangLuong: record, chiTiet: rows });
  } catch (err) {
    console.error("GET /bang-luong-thang/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
