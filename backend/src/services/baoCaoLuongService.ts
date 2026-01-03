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
  const phamvi = req.phamvi;
  if (!phamvi) {
    throw new Error("Thiếu thông tin phạm vi người dùng");
  }

  const q: any = req.query || {};

  const page = Number(q.page || 1);
  const limit = Number(q.limit || 20);
  const offset = (page - 1) * limit;

  const rawThang = q.thang;
  const thang = rawThang !== undefined && rawThang !== "" ? Number(rawThang) : undefined;

  const nam = Number(q.nam) || new Date().getFullYear();
  const phong_ban_id = Number(q.phong_ban_id);
  const keyword = typeof q.q === "string" ? q.q.trim() : undefined;
  const trang_thai = typeof q.trang_thai === "string" ? q.trang_thai.trim() : undefined;

  const params: any[] = [nam];
  let where = "WHERE l.nam = ? AND l.trang_thai_duyet = 'da_duyet'";

  // ===== GIỚI HẠN THEO PHẠM VI NGƯỜI DÙNG =====
  if (phamvi.role === "admin") {
    // admin: xem toàn bộ
  } else if (phamvi.role === "manager") {
    if (phamvi.isAccountingManager) {
      // manager phòng Kế toán: xem toàn bộ
    } else {
      // manager thường: chỉ xem nhân viên thuộc các phòng ban mà họ quản lý
      if (!phamvi.managedDepartmentIds || !phamvi.managedDepartmentIds.length) {
        where += " AND 1 = 0";
      } else {
        where += ` AND nv.phong_ban_id IN (${phamvi.managedDepartmentIds.map(() => "?").join(",")})`;
        params.push(...phamvi.managedDepartmentIds);
      }
    }
  } else if (phamvi.role === "employee") {
    if (!phamvi.employeeId) {
      throw new Error("Tài khoản không gắn nhân viên");
    }
    where += " AND l.nhan_vien_id = ?";
    params.push(phamvi.employeeId);
  }

  // ===== LỌC THÁNG / PHÒNG BAN / TỪ KHÓA / TRẠNG THÁI =====
  if (thang !== undefined) {
    where += " AND l.thang = ?";
    params.push(thang);
  }

  if (!isNaN(phong_ban_id)) {
    where += " AND nv.phong_ban_id = ?";
    params.push(phong_ban_id);
  }

  if (keyword) {
    where += ` AND (
      nv.ho_ten LIKE ? 
      OR nv.id LIKE ?
    )`;
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  if (trang_thai && trang_thai !== "all") {
    if (trang_thai === "no_debt") {
      where += " AND (l.luong_thuc_nhan - COALESCE(ls.da_tra, 0)) > 0";
    } else {
      where += " AND COALESCE(ls.trang_thai_cuoi, 'khong_ro') = ?";
      params.push(trang_thai);
    }
  }

  // ===== TRUY VẤN CHÍNH - LẤY THƯỞNG/PHẠT THEO THÁNG/NĂM TƯƠNG ỨNG =====
  const [rows] = await pool.query<any[]>(
    `
    SELECT 
      l.thang,
      l.nam,

      nv.id AS nhan_vien_id,
      nv.ho_ten,
      pb.ten_phong_ban AS phong_ban,
      cv.ten_chuc_vu AS chuc_vu,

      COALESCE(l.luong_p1, 0) AS luong_p1,
      COALESCE(l.luong_p2, 0) AS luong_p2,
      COALESCE(l.luong_p3, 0) AS luong_p3,
      COALESCE(l.tong_luong, 0) AS tong_luong,
      COALESCE(l.luong_thuc_nhan, 0) AS luong_thuc_nhan,

      COALESCE(l.bhxh, 0) AS bhxh,
      COALESCE(l.bhyt, 0) AS bhyt,
      COALESCE(l.bhtn, 0) AS bhtn,
      COALESCE(l.tong_bh, 0) AS tong_bh,
      COALESCE(l.thue_tncn, 0) AS thue_tncn,

      COALESCE(ptc.so_ngay_cong, 0) AS so_ngay_cong,
      COALESCE(ptc.so_ngay_nghi_phep, 0) AS so_ngay_nghi_phep,
      COALESCE(ptc.so_ngay_nghi_huong_luong, 0) AS so_ngay_nghi_huong_luong,
      COALESCE(ptc.gio_tang_ca, 0) AS gio_tang_ca,

      COALESCE(ls.da_tra, 0) AS da_tra,
      (COALESCE(l.luong_thuc_nhan,0) - COALESCE(ls.da_tra,0)) AS con_no,
      ls.ngay_tra_gan_nhat,
      COALESCE(ls.trang_thai_cuoi, 'khong_ro') AS trang_thai_cuoi,
      nth.ho_ten AS nguoi_duyet_ten,  -- Thêm tên người thực hiện

      COALESCE(tp_thuong.tong_thuong, 0) AS thuong,
      COALESCE(tp_phat.tong_phat, 0) AS phat,
      (COALESCE(l.luong_p3, 0) - COALESCE(tp_thuong.tong_thuong, 0) - COALESCE(tp_phat.tong_phat, 0)) AS tang_ca

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
            ) AS trang_thai_cuoi,
            MAX(nguoi_thuc_hien_id) AS nguoi_thuc_hien_id_cuoi  -- Lấy người thực hiện gần nhất
        FROM lich_su_tra_luong
        GROUP BY nhan_vien_id, thang, nam
    ) ls 
      ON ls.nhan_vien_id = l.nhan_vien_id
      AND ls.thang = l.thang
      AND ls.nam = l.nam

    LEFT JOIN nhan_vien nth ON nth.id = ls.nguoi_thuc_hien_id_cuoi  -- JOIN để lấy tên người thực hiện

    LEFT JOIN (
        SELECT nhan_vien_id, thang, nam, SUM(so_tien) AS tong_thuong
        FROM thuong_phat
        WHERE loai = 'THUONG'
        GROUP BY nhan_vien_id, thang, nam
    ) tp_thuong
      ON tp_thuong.nhan_vien_id = l.nhan_vien_id
      AND tp_thuong.thang = l.thang
      AND tp_thuong.nam = l.nam

    LEFT JOIN (
        SELECT nhan_vien_id, thang, nam, SUM(so_tien) AS tong_phat
        FROM thuong_phat
        WHERE loai = 'PHAT'
        GROUP BY nhan_vien_id, thang, nam
    ) tp_phat
      ON tp_phat.nhan_vien_id = l.nhan_vien_id
      AND tp_phat.thang = l.thang
      AND tp_phat.nam = l.nam

    ${where}
    ORDER BY nv.ho_ten ASC
    LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  // đảm bảo convert số trước khi tổng
  const safeNumber = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  return {
    tong_chi: rows.reduce((s, r) => s + safeNumber(r.luong_thuc_nhan), 0),
    tong_co_ban: rows.reduce((s, r) => s + safeNumber(r.luong_p1), 0),
    tong_phu_cap: rows.reduce((s, r) => s + safeNumber(r.luong_p2), 0),
    tong_p3: rows.reduce((s, r) => s + safeNumber(r.luong_p3), 0),

    tong_thuong: rows.reduce((s, r) => s + safeNumber(r.thuong), 0),
    tong_phat: rows.reduce((s, r) => s + safeNumber(r.phat), 0),

    /* tổng tiền tăng ca theo công thức P3 - (thuong + phat) */
    tong_tang_ca: rows.reduce((s, r) => s + safeNumber(r.tang_ca), 0),

    tong_bhxh: rows.reduce((s, r) => s + safeNumber(r.bhxh), 0),
    tong_bhyt: rows.reduce((s, r) => s + safeNumber(r.bhyt), 0),
    tong_bhtn: rows.reduce((s, r) => s + safeNumber(r.bhtn), 0),

    tong_thue: rows.reduce((s, r) => s + safeNumber(r.thue_tncn), 0),

    so_nv: rows.length,
    items: rows,
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
export const getLichSuTraLuong = async (nhan_vien_id: number, thang: number, nam: number) => {
  const [rows] = await pool.query(
    `
    SELECT 
      ls.id,
      ls.so_tien_thuc_tra,
      DATE_FORMAT(ls.ngay_tra, '%Y-%m-%d') AS ngay_tra,
      ls.trang_thai,
      ls.ghi_chu,
      ls.created_at,
      ls.updated_at,
      ls.nguoi_thuc_hien_id,
      nv2.ho_ten AS nguoi_thuc_hien
    FROM lich_su_tra_luong ls
    LEFT JOIN nhan_vien nv2 ON nv2.id = ls.nguoi_thuc_hien_id
    WHERE 
      ls.nhan_vien_id = ?
      AND ls.thang = ?
      AND ls.nam = ?
      AND COALESCE(ls.so_tien_thuc_tra, 0) > 0    -- chỉ lấy dòng có tiền
      AND ls.ngay_tra IS NOT NULL                 -- phải có ngày trả
    ORDER BY ls.ngay_tra ASC, ls.id ASC
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
type HeaderStyle = {
  font: Partial<ExcelJS.Font>;
  alignment: Partial<ExcelJS.Alignment>;
  border: Partial<ExcelJS.Borders>;
  fill: Partial<ExcelJS.Fill>;
};

interface EmployeeRecord {
  [key: string]: any;
}

export const exportBaoCaoLuongExcel = async (req: any) => {
  const { items } = await getBaoCaoLuong(req);

  const thang = req.query?.thang;
  const nam = req.query?.nam || new Date().getFullYear();

  const wb = new ExcelJS.Workbook();
  const title = thang ? `Tháng ${thang}-${nam}` : `Năm ${nam}`;
  const ws = wb.addWorksheet(`Báo cáo lương ${title}`);

  ws.views = [{ state: "frozen", ySplit: 6 }];
  const dataStartRow = 7;

  // ===== DANH SÁCH CỘT CẦN TÍNH TỔNG/ĐỊNH DẠNG SỐ =====
  const columnsToSumKeys = [
    "luong_p1",
    "luong_p2",
    "thuong",
    "phat",
    "tang_ca",
    "tong_luong",
    "luong_thuc_nhan",
    "bhxh",
    "bhyt",
    "bhtn",
    "tong_bh",
    "thue_tncn",
    "so_ngay_cong",
    "so_ngay_nghi_phep",
    "so_ngay_nghi_huong_luong",
    "gio_tang_ca",
    "da_tra",
    "con_no",
  ];

  // ===== CẤU TRÚC CỘT (GIỮ NGUYÊN) =====
  const columnsDefinition = [
    { header: "STT", key: "stt", width: 4, align: "center" },
    { header: "Tháng", key: "thang", width: 6, align: "center" },
    { header: "Mã NV", key: "nhan_vien_id", width: 8, align: "center" },
    { header: "Họ tên", key: "ho_ten", width: 22, align: "left" },
    { header: "Phòng ban", key: "phong_ban", width: 18, align: "left" },
    { header: "Chức vụ", key: "chuc_vu", width: 18, align: "left" },

    {
      header: "LƯƠNG",
      key: "luong",
      children: [
        { header: "P1", key: "luong_p1", width: 12 },
        { header: "P2", key: "luong_p2", width: 12 },
        {
          header: "P3",
          key: "luong_p3",
          width: 18,
          subColumns: ["thuong", "phat", "tang_ca"],
        },
        { header: "Tổng Gross", key: "tong_luong", width: 14 },
        { header: "Thực nhận", key: "luong_thuc_nhan", width: 14 },
      ],
    },

    {
      header: "BẢO HIỂM",
      key: "bao_hiem",
      children: [
        { header: "BHXH", key: "bhxh", width: 10 },
        { header: "BHYT", key: "bhyt", width: 10 },
        { header: "BHTN", key: "bhtn", width: 10 },
        { header: "Tổng BH", key: "tong_bh", width: 14 },
      ],
    },
    { header: "Thuế TNCN", key: "thue_tncn", width: 14 },

    {
      header: "NGÀY CÔNG & TĂNG CA",
      key: "cong_tac",
      children: [
        { header: "Ngày công", key: "so_ngay_cong", width: 12 },
        { header: "Nghỉ phép", key: "so_ngay_nghi_phep", width: 12 },
        { header: "Nghỉ hưởng lương", key: "so_ngay_nghi_huong_luong", width: 16 },
        { header: "Giờ tăng ca", key: "gio_tang_ca", width: 12 },
      ],
    },

    {
      header: "THANH TOÁN",
      key: "thanh_toan",
      children: [
        { header: "Đã trả", key: "da_tra", width: 14 },
        { header: "Còn nợ", key: "con_no", width: 14 },
        { header: "Ngày trả gần nhất", key: "ngay_tra_gan_nhat", width: 18 },
        { header: "Trạng thái", key: "trang_thai_cuoi", width: 14 },
      ],
    },
  ];

  // ✅ TÁCH FINAL KEYS
  const finalKeys: string[] = [];
  columnsDefinition.forEach((col) => {
    if (col.children) {
      col.children.forEach((child) => {
        if (child.subColumns) {
          finalKeys.push(...child.subColumns);
        } else {
          finalKeys.push(child.key);
        }
      });
    } else {
      finalKeys.push(col.key);
    }
  });

  // ✅ THIẾT LẬP ĐỘ RỘNG CỘT
  ws.columns = finalKeys.map((key) => {
    const isP3SubCol = ["thuong", "phat", "tang_ca"].includes(key);
    const width =
      columnsDefinition.find((c) => c.key === key)?.width ||
      columnsDefinition.flatMap((c) => c.children || []).find((c) => c.key === key)?.width ||
      18; // Default width

    return { key, width: isP3SubCol ? 18 : width };
  });

  // ===== TIÊU ĐỀ BÁO CÁO (ROW 1) =====
  const titleRow1 = ws.addRow([`BÁO CÁO LƯƠNG ${title}`]);
  ws.mergeCells(titleRow1.getCell(1).address, titleRow1.getCell(finalKeys.length).address);
  titleRow1.getCell(1).font = { bold: true, size: 16 };
  titleRow1.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  titleRow1.height = 30;

  ws.addRow([]); // ROW 2

  // ===== STYLE HEADER =====
  const styleHeader: HeaderStyle = {
    font: { bold: true, size: 10 },
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    border: {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    },
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    },
  };

  const applyStyle = (cell: ExcelJS.Cell, style: HeaderStyle) => {
    cell.font = style.font as ExcelJS.Font;
    cell.alignment = style.alignment as ExcelJS.Alignment;
    cell.border = style.border as ExcelJS.Borders;
    cell.fill = style.fill as ExcelJS.Fill;
  };

  // ===== HEADER ĐA CẤP (ROW 3, 4, 5) =====
  const headerRow3 = ws.getRow(3);
  const headerRow4 = ws.getRow(4);
  const headerRow5 = ws.getRow(5);
  headerRow3.height = headerRow4.height = headerRow5.height = 25;

  let currentCol = 1;

  columnsDefinition.forEach((col) => {
    const startCol = currentCol;

    if (!col.children) {
      const cell = headerRow3.getCell(startCol);
      cell.value = col.header;
      applyStyle(cell, styleHeader);
      ws.mergeCells(headerRow3.getCell(startCol).address, ws.getRow(5).getCell(startCol).address);
      currentCol++;
    } else {
      const cell = headerRow3.getCell(startCol);
      cell.value = col.header;
      applyStyle(cell, styleHeader);

      const totalChildCols = col.children.reduce((sum, child) => {
        return sum + (child.subColumns ? child.subColumns.length : 1);
      }, 0);

      const endCol = startCol + totalChildCols - 1;
      ws.mergeCells(headerRow3.getCell(startCol).address, headerRow3.getCell(endCol).address);

      col.children.forEach((child) => {
        const childCell = headerRow4.getCell(currentCol);
        childCell.value = child.header;
        applyStyle(childCell, styleHeader);

        if (child.subColumns) {
          // Merge ô header P3 (ROW 4)
          const p3EndCol = currentCol + child.subColumns.length - 1;
          ws.mergeCells(
            headerRow4.getCell(currentCol).address,
            headerRow4.getCell(p3EndCol).address
          );

          // Header cấp 3 (ROW 5) cho các subColumns của P3
          child.subColumns.forEach((subKey) => {
            const subCell = headerRow5.getCell(currentCol);
            subCell.value =
              subKey === "tang_ca" ? "Tăng ca" : subKey === "thuong" ? "Thưởng" : "Phạt";
            applyStyle(subCell, styleHeader);
            currentCol++;
          });
        } else {
          // Header cấp 2 không có cấp 3 (Merge ROW 4 và ROW 5)
          ws.mergeCells(
            headerRow4.getCell(currentCol).address,
            ws.getRow(5).getCell(currentCol).address
          );
          currentCol++;
        }
      });
    }
  });

  // ✅ SỬA LỖI: CHỈ ÁP DỤNG BORDER (KHÔNG GHI ĐÈ ALIGNMENT)
  for (let r = 3; r <= 5; r++) {
    for (let c = 1; c <= finalKeys.length; c++) {
      const cell = ws.getRow(r).getCell(c);
      if (!cell.style.border) {
        cell.border = styleHeader.border as ExcelJS.Borders;
      }
    }
  }

  // ===== DÒNG GIẢI THÍCH (ROW 6) - Căn giữa =====
  const descriptions: { [key: string]: string } = {
    luong_p1: "Lương cơ bản/Hợp đồng",
    luong_p2: "Thưởng hiệu suất/KPI",
    thuong: "Thưởng",
    phat: "Phạt",
    tang_ca: "Tăng ca",
    tong_luong: "Tổng lương Gross (P1+P2+P3)",
    luong_thuc_nhan: "Gross - Thuế - BH (Net)",
    bhxh: "Phần NLĐ đóng (8%)",
    bhyt: "Phần NLĐ đóng (1.5%)",
    bhtn: "Phần NLĐ đóng (1%)",
    tong_bh: "Tổng BH bắt buộc NLĐ đóng",
    thue_tncn: "Thuế thu nhập cá nhân",
    so_ngay_cong: "Số ngày làm việc thực tế",
    so_ngay_nghi_phep: "Số ngày nghỉ phép",
    so_ngay_nghi_huong_luong: "Số ngày nghỉ hưởng lương",
    gio_tang_ca: "Tổng giờ tăng ca đã duyệt",
    da_tra: "Tổng tiền đã thanh toán",
    con_no: "Số tiền còn phải trả",
  };

  const descriptionRow = ws.getRow(6);
  descriptionRow.height = 35;

  finalKeys.forEach((key, index) => {
    const colNumber = index + 1;
    const cell = descriptionRow.getCell(colNumber);
    cell.value = descriptions[key] || "";
    cell.font = { italic: true, size: 8 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5DC" } };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // ===== DỮ LIỆU (ROW 7 trở đi) =====
  items.forEach((r: any, i: number) => {
    const rowData: EmployeeRecord = {
      stt: i + 1,
      ...r,
      thuong: r.thuong || 0,
      phat: r.phat || 0,
      tang_ca: r.tang_ca || 0,
    };

    const rowValues = finalKeys.map((key) => {
      let value = rowData[key];

      if (columnsToSumKeys.includes(key) && value !== null && value !== undefined) {
        const numericValue = parseFloat(value);
        return isNaN(numericValue) ? null : numericValue;
      }

      return value;
    });

    const dataRow = ws.addRow(rowValues);
    dataRow.height = 20;

    dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };

      const column = ws.getColumn(colNumber);
      const key = column.key as string;

      // Căn chỉnh cột theo định nghĩa (ho_ten, phong_ban, chuc_vu, v.v...)
      const columnDef = columnsDefinition.find((c) => c.key === key);
      if (columnDef?.align) {
        cell.alignment = {
          horizontal: columnDef.align as ExcelJS.Alignment["horizontal"],
          vertical: "middle",
        };
      } else if (["ngay_tra_gan_nhat", "trang_thai_cuoi"].includes(key) || colNumber <= 3) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }

      // CĂN PHẢI CHO DỮ LIỆU SỐ
      if (columnsToSumKeys.includes(key)) {
        cell.alignment = { horizontal: "right", vertical: "middle" }; // <--- Đã sửa: Áp dụng ở đây thay vì cho toàn bộ cột
        // Áp dụng định dạng số
        column.numFmt =
          key.includes("ngay_cong") || key.includes("gio_tang_ca") ? "#,##0.00" : "#,##0";
      }

      if (column.key === "ngay_tra_gan_nhat" && cell.value) {
        cell.numFmt = "dd/mm/yyyy";
      }
    });
  });

  // ===== DÒNG TỔNG CỘNG =====
  const totalRowIndex = ws.rowCount + 1;
  const totalRow = ws.getRow(totalRowIndex);
  totalRow.height = 25;

  const totalStyle: HeaderStyle = {
    font: { bold: true, size: 10 },
    alignment: { horizontal: "center", vertical: "middle" },
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFC6E0B4" },
    },
    border: {
      top: { style: "medium" },
      left: { style: "thin" },
      bottom: { style: "medium" },
      right: { style: "thin" },
    },
  };

  const totalLabelCell = totalRow.getCell(1);
  totalLabelCell.value = "TỔNG CỘNG";
  totalLabelCell.font = totalStyle.font;
  totalLabelCell.alignment = totalStyle.alignment as ExcelJS.Alignment;

  const mergeEndCol = finalKeys.indexOf("chuc_vu") + 1;
  ws.mergeCells(totalRow.getCell(1).address, totalRow.getCell(mergeEndCol).address);

  for (let c = 1; c <= mergeEndCol; c++) {
    const cell = totalRow.getCell(c);
    cell.border = totalStyle.border as ExcelJS.Borders;
    cell.fill = totalStyle.fill as ExcelJS.Fill;
  }

  columnsToSumKeys.forEach((key) => {
    const colIndex = finalKeys.indexOf(key) + 1;
    if (colIndex > 0) {
      const cell = totalRow.getCell(colIndex);
      const colLetter = ws.getColumn(colIndex).letter;

      cell.value = {
        formula: `SUBTOTAL(9, ${colLetter}${dataStartRow}:${colLetter}${totalRowIndex - 1})`,
        date1904: false,
      };

      cell.numFmt = key.includes("ngay_cong") || key.includes("gio_tang_ca") ? "#,##0.00" : "#,##0";
      cell.font = totalStyle.font;
      cell.alignment = { horizontal: "right", vertical: "middle" };
      cell.border = totalStyle.border as ExcelJS.Borders;
      cell.fill = totalStyle.fill as ExcelJS.Fill;
    }
  });

  // ===== LƯU FILE =====
  const fileName = `bao_cao_luong_${thang || "nam"}_${nam}_${Date.now()}.xlsx`;
  const filePath = path.join(process.cwd(), "exports", fileName);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  await wb.xlsx.writeFile(filePath);

  return filePath;
};
