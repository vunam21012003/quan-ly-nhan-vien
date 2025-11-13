// src/controllers/chamCongController.ts
import { Request, Response } from "express";
import * as service from "../services/chamCongService";
import { pool } from "../db";
import fs from "fs";
import * as XLSX from "xlsx";
import { capNhatPhanTichCong } from "../services/phanTichCongService"; // ⬅️ dùng bảng tổng hợp mới

// ================== LẤY DANH SÁCH ==================
export const list = async (req: Request, res: Response) => {
  try {
    const data = await service.getList(req);
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
    await capNhatPhanTichCong(Number(nhan_vien_id), String(ngay_lam)); // ⬅️ tổng hợp theo tháng

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
    await capNhatPhanTichCong(Number(nhan_vien_id), String(ngay_lam)); // ⬅️

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

    const [[record]]: any = await pool.query(
      "SELECT nhan_vien_id, ngay_lam FROM cham_cong WHERE id = ?",
      [id]
    );
    if (!record) return res.status(404).json({ message: "Không tìm thấy bản ghi" });

    await pool.query("DELETE FROM cham_cong WHERE id = ?", [id]);

    // ⬅️ cập nhật lại thống kê tháng thay cho tong_gio_lam
    await capNhatPhanTichCong(Number(record.nhan_vien_id), String(record.ngay_lam));

    res.json({ message: "Đã xoá và cập nhật lại thống kê tháng" });
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

    let readPath = file.path;
    if (!readPath.endsWith(".xlsx")) {
      const newPath = `${readPath}.xlsx`;
      fs.copyFileSync(file.path, newPath);
      readPath = newPath;
    }

    await fs.promises.access(readPath, fs.constants.R_OK);
    const buffer = fs.readFileSync(readPath);
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

    // ✅ Lấy sheet đầu tiên an toàn
    const sheetName = (workbook.SheetNames && workbook.SheetNames[0]) || "";
    if (!sheetName)
      return res.status(400).json({ message: "Không tìm thấy sheet trong file Excel" });

    const sheet = (workbook.Sheets as any)[sheetName];
    if (!sheet) return res.status(400).json({ message: "Không tìm thấy sheet trong file Excel" });

    // ✅ Đọc toàn bộ sheet thành JSON
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      raw: false,
      dateNF: "yyyy-mm-dd",
    });

    console.log(`✅ Đọc ${rows.length} dòng từ file Excel.`);

    let added = 0,
      updated = 0,
      fail = 0;
    const affected: Array<{ nvId: number; ngay: string }> = [];

    // ================== HÀM CHUẨN HÓA DỮ LIỆU ==================
    function normalizeDate(value: any): string | null {
      if (!value) return null;

      // 1️⃣ Excel lưu ngày dạng số
      if (typeof value === "number") {
        const ssf = (XLSX as any).SSF;
        if (ssf?.parse_date_code) {
          const parsed = ssf.parse_date_code(value);
          if (parsed) {
            const y = parsed.y;
            const m = String(parsed.m).padStart(2, "0");
            const d = String(parsed.d).padStart(2, "0");
            return `${y}-${m}-${d}`;
          }
        }
        const date = new Date(Math.round((value - 25569) * 86400 * 1000));
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
          date.getDate()
        ).padStart(2, "0")}`;
      }

      // 2️⃣ Nếu là Date object
      if (value instanceof Date) {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, "0");
        const d = String(value.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }

      // 3️⃣ Nếu là chuỗi
      const str: string = String(value).trim().replace(/\./g, "/");
      const cleaned = str.split(" ")[0] as string;

      // ISO yyyy-mm-dd
      if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
        return cleaned;
      }

      // dd/mm/yyyy hoặc dd-mm-yyyy
      const regex: RegExp = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
      const match = cleaned.match(regex);

      if (match) {
        // ✅ ép kiểu rõ ràng để không bị báo đỏ
        const [_full, d1, m1, y] = match as [string, string, string, string];

        const month: string = m1.padStart(2, "0");
        const day: string = d1.padStart(2, "0");

        return `${y}-${month}-${day}`;
      }

      // 4️⃣ Date auto-parse
      const d = new Date(cleaned);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      }

      return null;
    }

    function normalizeTime(value: any): string | null {
      if (!value) return null;

      // Excel lưu giờ dạng phần thập phân của ngày (VD: 0.5 = 12:00)
      if (typeof value === "number") {
        const totalMinutes = Math.round(value * 24 * 60);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      }

      if (value instanceof Date) {
        const h = value.getHours();
        const m = value.getMinutes();
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      }

      const str = String(value).trim();

      // Dạng 08:10
      const match1 = str.match(/^(\d{1,2}):(\d{1,2})$/);
      if (match1) {
        const h = match1[1] || "0";
        const mi = match1[2] || "0";
        return `${h.padStart(2, "0")}:${mi.padStart(2, "0")}`;
      }

      // Dạng 8h10 hoặc 8h
      const match2 = str.match(/^(\d{1,2})h:?(\d{1,2})?$/i);
      if (match2) {
        const h = match2[1] || "0";
        const mi = match2[2] || "00";
        return `${h.padStart(2, "0")}:${mi.padStart(2, "0")}`;
      }

      return null;
    }

    // ================== XỬ LÝ DỮ LIỆU ==================
    for (const [i, r] of rows.entries()) {
      const nhan_vien_id = r?.nhan_vien_id;
      const ngay_lam = normalizeDate(r?.ngay || r?.ngay_lam);
      const gio_vao = normalizeTime(r?.check_in || r?.gio_vao);
      const gio_ra = normalizeTime(r?.check_out || r?.gio_ra);
      const ghi_chu_excel = r?.ghi_chu || "";

      if (!nhan_vien_id || !ngay_lam) {
        console.warn(`⚠️ Dòng ${i + 1} thiếu thông tin bắt buộc`);
        fail++;
        continue;
      }

      // Đảm bảo null an toàn
      const safeIn = gio_vao === undefined || gio_vao === null ? null : gio_vao;
      const safeOut = gio_ra === undefined || gio_ra === null ? null : gio_ra;

      try {
        const safeIn: string | null =
          gio_vao === undefined || gio_vao === null || gio_vao === "" ? null : gio_vao;

        const safeOut: string | null =
          gio_ra === undefined || gio_ra === null || gio_ra === "" ? null : gio_ra;

        // ✅ bây giờ gọi hàm evaluateChamCong sẽ không còn đỏ nữa
        const {
          trang_thai,
          ghi_chu: ghiChuAuto,
          tong_gio,
        } = await service.evaluateChamCong(
          Number(nhan_vien_id),
          String(ngay_lam),
          safeIn,
          safeOut,
          ghi_chu_excel
        );

        const finalNote =
          ghi_chu_excel &&
          (ghi_chu_excel.toLowerCase().includes("có phép") ||
            ghi_chu_excel.toLowerCase().includes("co phep") ||
            ghi_chu_excel.toLowerCase().includes("nghỉ") ||
            ghi_chu_excel.toLowerCase().includes("nghi"))
            ? ghi_chu_excel
            : ghiChuAuto;

        const [exist]: any = await pool.query(
          "SELECT id FROM cham_cong WHERE nhan_vien_id = ? AND ngay_lam = ?",
          [nhan_vien_id, ngay_lam]
        );

        if (exist.length > 0) {
          await pool.query(
            `UPDATE cham_cong 
             SET gio_vao=?, gio_ra=?, trang_thai=?, ghi_chu=?, tong_gio=? 
             WHERE nhan_vien_id=? AND ngay_lam=?`,
            [safeIn, safeOut, trang_thai, finalNote, tong_gio, nhan_vien_id, ngay_lam]
          );
          updated++;
        } else {
          await pool.query(
            `INSERT INTO cham_cong 
             (nhan_vien_id, ngay_lam, gio_vao, gio_ra, trang_thai, ghi_chu, tong_gio) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [nhan_vien_id, ngay_lam, safeIn, safeOut, trang_thai, finalNote, tong_gio]
          );
          added++;
        }

        affected.push({ nvId: Number(nhan_vien_id), ngay: String(ngay_lam) });
      } catch (err) {
        console.error("❌ Lỗi nhập dòng:", i + 1, err);
        fail++;
      }
    }

    // ✅ Cập nhật tổng hợp theo tháng
    const touched = new Set<string>();
    for (const a of affected) {
      const key = `${a.nvId}|${a.ngay.slice(0, 7)}`;
      if (touched.has(key)) continue;
      touched.add(key);
      await capNhatPhanTichCong(a.nvId, a.ngay);
    }

    // 🧹 Xóa file tạm
    try {
      fs.unlinkSync(file.path);
      if (fs.existsSync(`${file.path}.xlsx`)) fs.unlinkSync(`${file.path}.xlsx`);
    } catch {
      console.warn("⚠️ Không thể xoá file tạm:", file.path);
    }

    // ✅ Trả kết quả
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

// ================== EXPORT EXCEL ==================
export const exportExcel = async (req: Request, res: Response) => {
  try {
    const { from, to, phong_ban_id, trang_thai, nhan_vien_id } = req.query as any;

    const where: string[] = [];
    const params: any[] = [];

    if (from) {
      where.push("cc.ngay_lam >= ?");
      params.push(from);
    }
    if (to) {
      where.push("cc.ngay_lam <= ?");
      params.push(to);
    }
    if (phong_ban_id) {
      where.push("nv.phong_ban_id = ?");
      params.push(phong_ban_id);
    }
    if (trang_thai) {
      where.push("cc.trang_thai = ?");
      params.push(trang_thai);
    }
    if (nhan_vien_id) {
      where.push("cc.nhan_vien_id = ?");
      params.push(nhan_vien_id);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows]: any = await pool.query(
      `SELECT
          cc.id,
          nv.ho_ten AS "Họ tên",
          pb.ten_phong_ban AS "Phòng ban",
          cv.ten_chuc_vu AS "Chức vụ",
          cc.ngay_lam AS "Ngày làm",
          cc.gio_vao AS "Giờ vào",
          cc.gio_ra AS "Giờ ra",
          cc.trang_thai AS "Trạng thái",
          cc.ghi_chu AS "Ghi chú",
          cc.tong_gio AS "Tổng giờ (thô)"
       FROM cham_cong cc
       JOIN nhan_vien nv ON cc.nhan_vien_id = nv.id
       LEFT JOIN phong_ban pb ON nv.phong_ban_id = pb.id
       LEFT JOIN chuc_vu cv ON nv.chuc_vu_id = cv.id
       ${whereSql}
       ORDER BY cc.ngay_lam DESC, nv.ho_ten ASC`,
      params
    );

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ChamCong");

    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    const filename = `ChamCong_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  } catch (err) {
    console.error("EXPORT EXCEL ERROR:", err);
    res.status(500).json({ message: "Lỗi khi xuất file Excel" });
  }
};
