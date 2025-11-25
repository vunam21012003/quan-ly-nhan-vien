// ===============================================
// src/services/baoCaoLuongService.ts
// ===============================================
import { pool } from "../db";
import * as ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

/**
 * ===============================================
 *    LẤY BÁO CÁO LƯƠNG (TỔNG HỢP)
 *  Chuẩn kế toán: P1 - P2 - P3 + BH + Thuế + Ngày công
 * ===============================================
 */
export const getBaoCaoLuong = async (req: any) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const offset = (page - 1) * limit;

  const rawThang = req.query?.thang;
  const thang = rawThang !== undefined && rawThang !== "" ? Number(rawThang) : undefined;

  const nam = Number(req.query?.nam) || new Date().getFullYear();
  const phong_ban_id = Number(req.query?.phong_ban_id);
  const keyword = req.query?.q?.trim();
  const trang_thai = req.query?.trang_thai?.trim();

  const params: any[] = [nam];
  let where = "WHERE l.nam = ? AND l.trang_thai_duyet = 'da_duyet'";

  // lọc tháng
  if (thang !== undefined) {
    where += " AND l.thang = ?";
    params.push(thang);
  }

  // lọc phòng ban
  if (!isNaN(phong_ban_id)) {
    where += " AND nv.phong_ban_id = ?";
    params.push(phong_ban_id);
  }

  // lọc keyword
  if (keyword) {
    where += `
      AND (
        nv.ho_ten LIKE ? 
        OR nv.id LIKE ?
      )
    `;
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  // lọc trạng thái
  if (trang_thai && trang_thai !== "all") {
    if (trang_thai === "no_debt") {
      where += " AND (l.luong_thuc_nhan - COALESCE(ls.da_tra, 0)) > 0";
    } else {
      where += " AND COALESCE(ls.trang_thai_cuoi, 'khong_ro') = ?";
      params.push(trang_thai);
    }
  }

  // ===== DỮ LIỆU TRANG HIỆN TẠI =====
  const [rows] = await pool.query<any[]>(
    `
    SELECT 
      l.thang,
      l.nam,

      nv.id AS nhan_vien_id,
      nv.ho_ten,
      pb.ten_phong_ban AS phong_ban,
      cv.ten_chuc_vu AS chuc_vu,

      l.luong_p1,
      l.luong_p2,
      l.luong_p3,
      l.tong_luong,
      l.luong_thuc_nhan,

      l.bhxh,
      l.bhyt,
      l.bhtn,
      l.tong_bh,
      l.thue_tncn,

      ptc.so_ngay_cong,
      ptc.so_ngay_nghi_phep,
      ptc.so_ngay_nghi_huong_luong,
      ptc.gio_tang_ca,

      COALESCE(ls.da_tra, 0) AS da_tra,
      (l.luong_thuc_nhan - COALESCE(ls.da_tra, 0)) AS con_no,
      ls.ngay_tra_gan_nhat,
      COALESCE(ls.trang_thai_cuoi, 'khong_ro') AS trang_thai_cuoi

    FROM luong l
    JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
    LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
    LEFT JOIN chuc_vu cv ON cv.id = nv.chuc_vu_id

    LEFT JOIN phan_tich_cong ptc 
      ON ptc.nhan_vien_id = nv.id
      AND ptc.thang = l.thang 
      AND ptc.nam = l.nam

    LEFT JOIN (
        SELECT 
            nhan_vien_id,
            thang,
            nam,
            SUM(so_tien_thuc_tra) AS da_tra,
            MAX(ngay_tra) AS ngay_tra_gan_nhat,
            SUBSTRING_INDEX(
                GROUP_CONCAT(trang_thai ORDER BY updated_at DESC, id DESC),
                ',', 1
            ) AS trang_thai_cuoi
        FROM lich_su_tra_luong
        GROUP BY nhan_vien_id, thang, nam
    ) ls 
      ON ls.nhan_vien_id = l.nhan_vien_id
      AND ls.thang = l.thang
      AND ls.nam = l.nam

    ${where}
    ORDER BY nv.ho_ten ASC
    LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  return {
    tong_chi: rows.reduce((s, r) => s + Number(r.luong_thuc_nhan), 0),
    tong_co_ban: rows.reduce((s, r) => s + Number(r.luong_p1), 0),
    tong_phu_cap: rows.reduce((s, r) => s + Number(r.luong_p2), 0),
    tong_thuong: rows.reduce((s, r) => s + Number(r.luong_p3), 0),

    // Tổng BH
    tong_bhxh: rows.reduce((s, r) => s + Number(r.bhxh), 0),
    tong_bhyt: rows.reduce((s, r) => s + Number(r.bhyt), 0),
    tong_bhtn: rows.reduce((s, r) => s + Number(r.bhtn), 0),

    // Tổng thuế
    tong_thue: rows.reduce((s, r) => s + Number(r.thue_tncn), 0),

    so_nv: rows.length,
    items: rows, // ⭐ GIỮ NGUYÊN "items"
  };
};

/**
 * ===============================================
 *    LẤY CHI TIẾT LƯƠNG NHÂN VIÊN
 * ===============================================
 */
export const getChiTietLuongNhanVien = async (nhan_vien_id: number, thang: number, nam: number) => {
  // ===== 1. Lấy chi tiết bảng lương =====
  const [rows]: any = await pool.query(
    `
    SELECT 
      l.id,
      nv.ho_ten,
      pb.ten_phong_ban AS phong_ban,
      cv.ten_chuc_vu AS chuc_vu,
      l.thang,
      l.nam,

      l.luong_p1 AS p1_luong,
      l.luong_p2 AS p2_phu_cap,
      l.luong_p3 AS p3_khac,

      ptc.so_ngay_cong,
      ptc.so_ngay_nghi_phep,
      ptc.so_ngay_nghi_huong_luong,
      ptc.gio_tang_ca,

      l.bhxh,
      l.bhyt,
      l.bhtn,
      l.tong_bh,
      l.thue_tncn,

      l.tong_luong,
      l.luong_thuc_nhan,
      l.trang_thai_duyet,

      ls.da_tra,
      (l.luong_thuc_nhan - COALESCE(ls.da_tra, 0)) AS con_no,
      ls.ngay_tra_gan_nhat,
      ls.trang_thai_cuoi

    FROM luong l
    JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
    LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
    LEFT JOIN chuc_vu cv ON cv.id = nv.chuc_vu_id

    LEFT JOIN phan_tich_cong ptc
      ON ptc.nhan_vien_id = nv.id
      AND ptc.thang = l.thang
      AND ptc.nam = l.nam

    LEFT JOIN (
        SELECT 
            nhan_vien_id,
            thang,
            nam,
            SUM(so_tien_thuc_tra) AS da_tra,
            MAX(ngay_tra) AS ngay_tra_gan_nhat,
            SUBSTRING_INDEX(
                GROUP_CONCAT(trang_thai ORDER BY updated_at DESC, id DESC),
                ',', 1
            ) AS trang_thai_cuoi
        FROM lich_su_tra_luong
        GROUP BY nhan_vien_id, thang, nam
    ) ls
        ON ls.nhan_vien_id = l.nhan_vien_id
        AND ls.thang = l.thang
        AND ls.nam = l.nam

    WHERE l.nhan_vien_id = ? AND l.thang = ? AND l.nam = ?
    `,
    [nhan_vien_id, thang, nam]
  );

  const data = rows[0] || null;
  if (!data) return null;

  // ===== 2. Lấy toàn bộ lịch sử trả lương =====
  const [lichSu]: any = await pool.query(
    `
      SELECT 
        DATE_FORMAT(ls.ngay_tra, '%d/%m/%Y') AS ngay_tra,
        ls.so_tien_thuc_tra AS so_tien,
        nv.ho_ten AS nguoi_thuc_hien
      FROM lich_su_tra_luong ls
      LEFT JOIN nhan_vien nv ON nv.id = ls.nguoi_thuc_hien_id
      WHERE ls.nhan_vien_id = ? AND ls.thang = ? AND ls.nam = ?
      ORDER BY ls.created_at ASC
    `,
    [nhan_vien_id, thang, nam]
  );

  // ===== 3. Trả về kết quả cho FE =====
  return {
    ...data,
    lich_su: lichSu || [], // ⭐ Thêm lịch sử vào chi tiết lương
  };
};

// ===============================================
//   LẤY LỊCH SỬ TRẢ LƯƠNG THEO TỪNG LẦN TRẢ
// ===============================================
// ===============================================
//   LẤY LỊCH SỬ TRẢ LƯƠNG THEO TỪNG LẦN TRẢ (ĐÃ LỌC ĐÚNG)
// ===============================================
export const getLichSuTraLuong = async (nhan_vien_id: number, thang: number, nam: number) => {
  const [rows] = await pool.query(
    `
    SELECT 
      id,
      so_tien_thuc_tra,
      DATE_FORMAT(ngay_tra, '%Y-%m-%d') AS ngay_tra,
      trang_thai,
      ghi_chu,
      created_at,
      updated_at
    FROM lich_su_tra_luong
    WHERE 
      nhan_vien_id = ?
      AND thang = ?
      AND nam = ?
      AND COALESCE(so_tien_thuc_tra, 0) > 0      -- 🔥 CHỈ LẤY DÒNG CÓ TIỀN
      AND ngay_tra IS NOT NULL                   -- 🔥 PHẢI CÓ NGÀY TRẢ
    ORDER BY ngay_tra ASC, id ASC
  `,
    [nhan_vien_id, thang, nam]
  );

  return rows;
};

/**
 * ===============================================
 *    XUẤT EXCEL
 * ===============================================
 */
export const exportBaoCaoLuongExcel = async (req: any) => {
  const { items } = await getBaoCaoLuong(req);

  const thang = req.query?.thang;
  const nam = req.query?.nam || new Date().getFullYear();

  const wb = new ExcelJS.Workbook();
  const title = thang ? `Tháng ${thang}/${nam}` : `Năm ${nam}`;
  const ws = wb.addWorksheet(`Báo cáo lương ${title}`);

  // ===== TIÊU ĐỀ =====
  ws.addRow([`BÁO CÁO LƯƠNG ${title}`]);
  ws.mergeCells("A1:Y1");
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A1").alignment = { horizontal: "center" };

  ws.addRow([]); // dòng trống

  // ===== CẤU TRÚC CỘT =====
  ws.columns = [
    { header: "STT", key: "stt", width: 6 },
    { header: "Tháng", key: "thang", width: 8 },
    { header: "Mã NV", key: "nhan_vien_id", width: 10 },
    { header: "Họ tên", key: "ho_ten", width: 22 },
    { header: "Phòng ban", key: "phong_ban", width: 18 },
    { header: "Chức vụ", key: "chuc_vu", width: 18 },

    { header: "P1", key: "luong_p1", width: 12 },
    { header: "P2", key: "luong_p2", width: 12 },
    { header: "P3", key: "luong_p3", width: 12 },
    { header: "Tổng Gross", key: "tong_luong", width: 14 },
    { header: "Thực nhận", key: "luong_thuc_nhan", width: 14 },

    { header: "BHXH", key: "bhxh", width: 10 },
    { header: "BHYT", key: "bhyt", width: 10 },
    { header: "BHTN", key: "bhtn", width: 10 },
    { header: "Tổng BH", key: "tong_bh", width: 14 },
    { header: "Thuế TNCN", key: "thue_tncn", width: 14 },

    { header: "Ngày công", key: "so_ngay_cong", width: 12 },
    { header: "Nghỉ phép", key: "so_ngay_nghi_phep", width: 12 },
    { header: "Nghỉ hưởng lương", key: "so_ngay_nghi_huong_luong", width: 16 },
    { header: "Giờ tăng ca", key: "gio_tang_ca", width: 12 },

    { header: "Đã trả", key: "da_tra", width: 14 },
    { header: "Còn nợ", key: "con_no", width: 14 },
    { header: "Ngày trả gần nhất", key: "ngay_tra_gan_nhat", width: 18 },
    { header: "Trạng thái", key: "trang_thai_cuoi", width: 14 },
  ];

  // 👉 THÊM DÒNG HEADER CỘT
  const headerRow = ws.addRow(ws.columns.map((c) => c.header));
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };

  // ===== DỮ LIỆU =====
  items.forEach((r: any, i) => {
    ws.addRow({
      stt: i + 1,
      ...r,
    });
  });

  // ===== FORMAT SỐ =====
  ws.columns.forEach((col) => {
    if (
      ["ho_ten", "phong_ban", "chuc_vu", "ngay_tra_gan_nhat", "trang_thai_cuoi"].includes(
        col.key as string
      )
    )
      return;

    col.numFmt = "#,##0";
  });

  // ===== LƯU =====
  const fileName = `bao_cao_luong_${thang || "nam"}_${nam}_${Date.now()}.xlsx`;
  const filePath = path.join(process.cwd(), "exports", fileName);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  await wb.xlsx.writeFile(filePath);

  return filePath;
};
