// ===============================================
// src/services/baoCaoLuongService.ts
// ===============================================
import { pool } from "../db";
import * as ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

/**
 * ===============================================
 * LẤY BÁO CÁO LƯƠNG
 * ===============================================
 */
export const getBaoCaoLuong = async (req: any) => {
  const thang = Number(req.query?.thang);
  const nam = Number(req.query?.nam) || new Date().getFullYear();
  const phong_ban_id = Number(req.query?.phong_ban_id);
  const nhan_vien_id = Number(req.query?.nhan_vien_id);

  const params: any[] = [nam];
  let whereSql = "WHERE l.nam = ?";

  if (!isNaN(thang)) {
    whereSql += " AND l.thang = ?";
    params.push(thang);
  }

  if (!isNaN(phong_ban_id)) {
    whereSql += " AND nv.phong_ban_id = ?";
    params.push(phong_ban_id);
  }

  if (!isNaN(nhan_vien_id)) {
    whereSql += " AND nv.id = ?";
    params.push(nhan_vien_id);
  }

  // Truy vấn dữ liệu
  const [rows] = await pool.query<any[]>(
    `
    SELECT 
      l.thang,
      nv.id AS nhan_vien_id,
      nv.ho_ten,
      pb.ten_phong_ban AS phong_ban,
      cv.ten_chuc_vu AS chuc_vu,
      l.luong_thoa_thuan,
      l.luong_p2 AS phu_cap,
      l.luong_p3 AS thuong,
      0 AS khoan_khac,
      l.luong_thuc_nhan AS thuc_nhan,
      l.tong_luong,
      l.trang_thai_duyet
    FROM luong l
    JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
    LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
    LEFT JOIN chuc_vu cv ON cv.id = nv.chuc_vu_id
    ${whereSql}
    ORDER BY l.thang ASC, nv.ho_ten ASC
    `,
    params
  );

  // ================== Gom nhóm theo tháng nếu KHÔNG chọn tháng ==================
  const grouped: Record<number, any[]> = {};

  if (Number.isNaN(thang)) {
    for (const r of rows) {
      const th = Number((r as any).thang) || 0;
      if (!grouped[th]) grouped[th] = [];
      grouped[th].push(r);
    }
  }

  // ================== Tổng hợp ==================
  const tongChi = (rows as any[]).reduce(
    (sum: number, r: any) => sum + Number(r.thuc_nhan ?? 0),
    0
  );
  const tongCoBan = (rows as any[]).reduce(
    (sum: number, r: any) => sum + Number(r.luong_thoa_thuan ?? 0),
    0
  );
  const tongPhuCap = (rows as any[]).reduce(
    (sum: number, r: any) => sum + Number(r.phu_cap ?? 0),
    0
  );
  const tongThuong = (rows as any[]).reduce(
    (sum: number, r: any) => sum + Number(r.thuong ?? 0),
    0
  );

  // ================== Trả kết quả ==================
  return {
    tong_chi: tongChi,
    tong_co_ban: tongCoBan,
    tong_phu_cap: tongPhuCap,
    tong_thuong: tongThuong,
    tong_khac: 0,
    so_nv: rows.length,
    items: rows,
    grouped_by_thang: grouped,
  };
};

/**
 * ===============================================
 * LẤY CHI TIẾT LƯƠNG NHÂN VIÊN
 * ===============================================
 */
export const getChiTietLuongNhanVien = async (
  nhan_vien_id: number,
  thang: number,
  nam: number
): Promise<any> => {
  const [rows]: any = await pool.query(
    `
    SELECT 
      l.id,
      nv.ho_ten,
      pb.ten_phong_ban AS phong_ban,
      cv.ten_chuc_vu AS chuc_vu,
      l.thang,
      l.nam,
      l.luong_thoa_thuan AS p1_luong,
      l.luong_p2 AS p2_phu_cap,
      l.luong_p3 AS p3_khac,
      l.ngay_cong,
      l.gio_tang_ca,
      l.bhxh,
      l.bhyt,
      l.bhtn,
      l.thue_tncn,
      l.tong_bh,
      l.tong_luong,
      l.luong_thuc_nhan,
      l.trang_thai_duyet
    FROM luong l
    JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
    LEFT JOIN phong_ban pb ON pb.id = nv.phong_ban_id
    LEFT JOIN chuc_vu cv ON cv.id = nv.chuc_vu_id
    WHERE l.nhan_vien_id = ? AND l.thang = ? AND l.nam = ?
    `,
    [nhan_vien_id, thang, nam]
  );

  return rows[0] || null;
};

/**
 * ===============================================
 * XUẤT FILE EXCEL
 * ===============================================
 */
export const exportBaoCaoLuongExcel = async (req: any) => {
  const { items } = await getBaoCaoLuong(req);
  const thang = req.query?.thang;
  const nam = req.query?.nam || new Date().getFullYear();

  const workbook = new ExcelJS.Workbook();
  const sheetName = thang ? `Tháng ${thang}/${nam}` : `Năm ${nam}`;
  const ws = workbook.addWorksheet(`Báo cáo lương ${sheetName}`);

  ws.addRow([`BÁO CÁO LƯƠNG ${sheetName}`]);
  ws.mergeCells("A1:I1");
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A1").alignment = { horizontal: "center" };
  ws.addRow([]);

  ws.columns = [
    { header: "STT", key: "stt", width: 6 },
    { header: "Tháng", key: "thang", width: 10 },
    { header: "Mã NV", key: "nhan_vien_id", width: 10 },
    { header: "Họ tên", key: "ho_ten", width: 25 },
    { header: "Phòng ban", key: "phong_ban", width: 20 },
    { header: "Chức vụ", key: "chuc_vu", width: 20 },
    { header: "Lương thỏa thuận", key: "luong_thoa_thuan", width: 20 },
    { header: "Phụ cấp", key: "phu_cap", width: 15 },
    { header: "Thưởng", key: "thuong", width: 15 },
    { header: "Thực nhận", key: "thuc_nhan", width: 20 },
  ];

  items.forEach((r: any, i: number) => {
    ws.addRow({
      stt: i + 1,
      thang: r.thang,
      nhan_vien_id: r.nhan_vien_id,
      ho_ten: r.ho_ten,
      phong_ban: r.phong_ban,
      chuc_vu: r.chuc_vu,
      luong_thoa_thuan: r.luong_thoa_thuan,
      phu_cap: r.phu_cap,
      thuong: r.thuong,
      thuc_nhan: r.thuc_nhan,
    });
  });

  ws.getRow(3).font = { bold: true };
  ws.getRow(3).alignment = { horizontal: "center" };
  ws.columns.forEach((col) => (col.numFmt = "#,##0"));

  const fileName = `bao_cao_luong_${thang || "nam"}_${nam}_${Date.now()}.xlsx`;
  const filePath = path.join(process.cwd(), "exports", fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  await workbook.xlsx.writeFile(filePath);

  return filePath;
};
