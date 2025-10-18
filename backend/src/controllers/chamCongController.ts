import { Request, Response } from "express";
import * as service from "../services/chamCongService";
import { pool } from "../db";
import fs from "fs";
import * as XLSX from "xlsx";
import { capNhatTongGioLam } from "../services/tongGioService";

// ================== LẤY DANH SÁCH ==================
export const list = async (req: Request, res: Response) => {
  try {
    const data = await service.getList(req); // đảm bảo trong service có export getList
    res.json(data);
  } catch (err) {
    console.error("GET /cham-cong error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ================== TẠO MỚI ==================
export const create = async (req: Request, res: Response) => {
  try {
    const result = await service.createChamCong(req);
    if ((result as any).error) {
      return res.status((result as any).status || 400).json({ message: (result as any).error });
    }

    const { nhan_vien_id, ngay_lam } = req.body;
    await capNhatTongGioLam(nhan_vien_id, ngay_lam);

    res.status(201).json((result as any).data);
  } catch (err) {
    console.error("POST /cham-cong error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ================== CẬP NHẬT ==================
export const update = async (req: Request, res: Response) => {
  try {
    const ok = await service.updateChamCong(req);
    if (!ok) return res.status(404).json({ message: "Không tìm thấy" });

    const { nhan_vien_id, ngay_lam } = req.body;
    await capNhatTongGioLam(nhan_vien_id, ngay_lam);

    res.json({ message: "Đã cập nhật" });
  } catch (err) {
    console.error("PUT /cham-cong/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ================== XOÁ ==================
export const remove = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      return res.status(400).json({ message: "ID không hợp lệ" });

    // 🔍 1. Lấy thông tin chấm công trước khi xoá
    const [[record]]: any = await pool.query(
      "SELECT nhan_vien_id, ngay_lam FROM cham_cong WHERE id = ?",
      [id]
    );
    if (!record) return res.status(404).json({ message: "Không tìm thấy bản ghi" });

    const nhan_vien_id = record.nhan_vien_id;
    const ngay_lam = record.ngay_lam;

    // 🔥 2. Xoá bản ghi chấm công
    const [r]: any = await pool.query("DELETE FROM cham_cong WHERE id = ?", [id]);
    if (r.affectedRows === 0)
      return res.status(404).json({ message: "Không tìm thấy dữ liệu cần xoá" });

    // ✅ 3. Tính lại toàn bộ tổng giờ làm trong tháng đó của nhân viên
    // => Xoá bản ghi cũ trong tong_gio_lam rồi tính lại từ đầu
    const ngayLamStr =
      typeof record.ngay_lam === "string"
        ? record.ngay_lam
        : record.ngay_lam instanceof Date
          ? record.ngay_lam.toISOString().slice(0, 10)
          : String(record.ngay_lam);

    const thang_nam = ngayLamStr.slice(0, 7); // YYYY-MM
    await pool.query("DELETE FROM tong_gio_lam WHERE nhan_vien_id = ? AND thang_nam = ?", [
      nhan_vien_id,
      thang_nam,
    ]);

    // ✅ 4. Gọi lại hàm tổng hợp để tính lại đúng theo chấm công còn lại
    await capNhatTongGioLam(nhan_vien_id, ngay_lam);

    res.json({ message: "Đã xoá và cập nhật lại tổng giờ làm" });
  } catch (err) {
    console.error("DELETE /cham-cong/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ================== IMPORT EXCEL ==================
export const importExcel = async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "Không có file tải lên" });

    console.log("📂 Đang đọc file Excel:", file.path);

    if (!fs.existsSync(file.path)) {
      console.error("❌ File không tồn tại:", file.path);
      return res.status(400).json({ message: "Không tìm thấy file Excel" });
    }

    // Đảm bảo có đuôi .xlsx
    let readPath = file.path;
    if (!readPath.endsWith(".xlsx")) {
      const newPath = `${readPath}.xlsx`;
      fs.copyFileSync(file.path, newPath);
      readPath = newPath;
    }

    await fs.promises.access(readPath, fs.constants.R_OK);

    const buffer = fs.readFileSync(readPath);
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName as keyof typeof workbook.Sheets] as XLSX.WorkSheet;
    if (!sheet) return res.status(400).json({ message: "Không tìm thấy sheet trong file Excel" });

    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet);
    console.log(`✅ Đọc ${rows.length} dòng từ file Excel.`);

    let added = 0,
      updated = 0,
      fail = 0;

    for (const [i, r] of rows.entries()) {
      const nhan_vien_id = r?.nhan_vien_id;
      const ngay_lam = r?.ngay || r?.ngay_lam;
      const gio_vao = r?.check_in || r?.gio_vao;
      const gio_ra = r?.check_out || r?.gio_ra;
      const ghi_chu_excel = r?.ghi_chu || ""; // ⬅ ghi chú nhập từ Excel

      if (!nhan_vien_id || !ngay_lam) {
        console.warn(`⚠️ Dòng ${i + 1} thiếu thông tin bắt buộc`);
        fail++;
        continue;
      }

      // ✅ Gọi service để tính toán tự động
      const {
        trang_thai,
        ghi_chu: ghiChuAuto,
        tong_gio,
      } = await service.evaluateChamCong(
        Number(nhan_vien_id),
        ngay_lam,
        gio_vao,
        gio_ra,
        ghi_chu_excel
      );

      // ✅ Ưu tiên ghi chú tự tính, chỉ giữ ghi chú Excel nếu có “có phép” hoặc “nghỉ phép”
      const finalNote =
        ghi_chu_excel &&
        (ghi_chu_excel.toLowerCase().includes("có phép") ||
          ghi_chu_excel.toLowerCase().includes("co phep") ||
          ghi_chu_excel.toLowerCase().includes("nghỉ") ||
          ghi_chu_excel.toLowerCase().includes("nghi"))
          ? ghi_chu_excel
          : ghiChuAuto;

      try {
        const [exist]: any = await pool.query(
          "SELECT id FROM cham_cong WHERE nhan_vien_id = ? AND ngay_lam = ?",
          [nhan_vien_id, ngay_lam]
        );

        if (exist.length > 0) {
          // Cập nhật
          await pool.query(
            `UPDATE cham_cong 
             SET gio_vao=?, gio_ra=?, trang_thai=?, ghi_chu=?, tong_gio=? 
             WHERE nhan_vien_id=? AND ngay_lam=?`,
            [
              gio_vao || null,
              gio_ra || null,
              trang_thai,
              finalNote, // ✅ ghi chú chuẩn
              tong_gio,
              nhan_vien_id,
              ngay_lam,
            ]
          );
          updated++;
        } else {
          // Thêm mới
          await pool.query(
            `INSERT INTO cham_cong 
               (nhan_vien_id, ngay_lam, gio_vao, gio_ra, trang_thai, ghi_chu, tong_gio) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              nhan_vien_id,
              ngay_lam,
              gio_vao || null,
              gio_ra || null,
              trang_thai,
              finalNote, // ✅ ghi chú chuẩn
              tong_gio,
            ]
          );
          added++;
        }

        // ✅ Cập nhật lại tổng giờ làm
        await capNhatTongGioLam(nhan_vien_id, ngay_lam);
      } catch (err) {
        console.error("❌ Lỗi nhập dòng:", i + 1, err);
        fail++;
      }
    }

    // 🧹 Dọn file tạm sau khi xử lý xong
    try {
      fs.unlinkSync(file.path);
      if (fs.existsSync(`${file.path}.xlsx`)) fs.unlinkSync(`${file.path}.xlsx`);
    } catch {
      console.warn("⚠️ Không thể xoá file tạm:", file.path);
    }

    res.json({
      message: `✅ Import hoàn tất: ${added} mới, ${updated} cập nhật, ${fail} lỗi.`,
      added,
      updated,
      fail,
    });
  } catch (err) {
    console.error("IMPORT EXCEL ERROR:", err);
    res.status(500).json({ message: "Lỗi khi xử lý file Excel" });
  }
};
