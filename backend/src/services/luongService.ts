// ===============================================
// src/services/luongService.ts
// ===============================================

import { pool } from "../db";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { Request } from "express";

// ===============================================
// HÀM HỖ TRỢ: TÍNH CÔNG CHUẨN CỦA THÁNG (MỚI THÊM)
// ===============================================
const getStandardWorkingDays = (month: number, year: number): number => {
  const daysInMonth = new Date(year, month, 0).getDate();
  let workingDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay(); // 0 = Chủ nhật
    if (dayOfWeek !== 0) {
      workingDays++;
    }
  }
  return workingDays;
};

// ===============================================
// TỶ LỆ BẢO HIỂM (GIỮ NGUYÊN)
// ===============================================
const INSURANCE_RATES = {
  BHXH: 0.08,
  BHYT: 0.015,
  BHTN: 0.01,
};

// ===============================================
// HÀM TÍNH THUẾ TNCN LŨY TIẾN (GIỮ NGUYÊN)
// ===============================================
const calcTNCN = (thuNhap: number): number => {
  if (thuNhap <= 0) return 0;

  if (thuNhap <= 5000000) return thuNhap * 0.05;
  if (thuNhap <= 10000000) return 250000 + (thuNhap - 5000000) * 0.1;
  if (thuNhap <= 18000000) return 750000 + (thuNhap - 10000000) * 0.15;
  if (thuNhap <= 32000000) return 1950000 + (thuNhap - 18000000) * 0.2;
  if (thuNhap <= 52000000) return 4750000 + (thuNhap - 32000000) * 0.25;
  if (thuNhap <= 80000000) return 9750000 + (thuNhap - 52000000) * 0.3;

  return 18150000 + (thuNhap - 80000000) * 0.35;
};

// ===============================================
// LẤY DANH SÁCH LƯƠNG (GIỮ NGUYÊN)
// ===============================================
export const getAll = async (req: any) => {
  const { thang, nam, page = 1, limit = 10 } = req.query;
  const scope = req.phamvi;
  const offset = (Number(page) - 1) * Number(limit);

  let where = "";
  const params: any[] = [];

  if (thang) {
    where += " AND l.thang = ?";
    params.push(thang);
  }
  if (nam) {
    where += " AND l.nam = ?";
    params.push(nam);
  }

  if (scope.role === "employee") {
    where += " AND l.nhan_vien_id = ?";
    params.push(scope.employeeId);
  }

  if (scope.role === "manager") {
    if (scope.isAccountingManager) {
      // full quyền
    } else {
      if (!scope.managedDepartmentIds.length) {
        return { items: [], total: 0 };
      }
      where += ` AND nv.phong_ban_id IN (${scope.managedDepartmentIds.map(() => "?").join(",")})`;
      params.push(...scope.managedDepartmentIds);
    }
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `
    SELECT l.*, nv.ho_ten
    FROM luong l
    JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
    LEFT JOIN phan_tich_cong ptc 
      ON ptc.nhan_vien_id = l.nhan_vien_id
      AND ptc.thang = l.thang
      AND ptc.nam = l.nam
    WHERE 1=1 ${where}
    ORDER BY l.nam DESC, l.thang DESC
    LIMIT ? OFFSET ?
  `,
    [...params, Number(limit), offset]
  );

  const [[{ total }]]: any = await pool.query(
    `SELECT COUNT(*) as total 
     FROM luong l 
     JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
     WHERE 1=1 ${where}`,
    params
  );

  return { items: rows, total };
};

// ===============================================
// LẤY LƯƠNG CỦA TÔI (GIỮ NGUYÊN)
// ===============================================
export const getMine = async (req: any) => {
  const user = req.user;
  const [rows] = await pool.query<RowDataPacket[]>(
    `
    SELECT l.*, nv.ho_ten 
    FROM luong l
    JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
    JOIN tai_khoan tk ON tk.nhan_vien_id = nv.id
    WHERE tk.id = ?
    ORDER BY l.nam DESC, l.thang DESC
    `,
    [user.id]
  );
  return rows;
};

// ===============================================
// LẤY CHI TIẾT (GIỮ NGUYÊN)
// ===============================================
export const getById = async (req: any) => {
  const id = Number(req.params.id);
  const [rows] = await pool.query<RowDataPacket[]>(
    `
    SELECT l.*, nv.ho_ten
    FROM luong l
    JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
    WHERE l.id = ?
    `,
    [id]
  );
  return rows[0] || null;
};

// ===============================================
// TẠO THỦ CÔNG (GIỮ NGUYÊN)
// ===============================================
export const create = async (body: any) => {
  const {
    nhan_vien_id,
    thang,
    nam,
    luong_thoa_thuan,
    luong_p2,
    luong_p3,
    tong_luong,
    bhxh,
    bhyt,
    bhtn,
    tong_bh,
    luong_thuc_nhan,
  } = body;

  if (!nhan_vien_id || !thang || !nam) return { error: "Thiếu dữ liệu cần thiết." };

  const [result] = await pool.query<ResultSetHeader>(
    `
    INSERT INTO luong (
      nhan_vien_id, thang, nam,
      luong_thoa_thuan, luong_p2, luong_p3,
      tong_luong, bhxh, bhyt, bhtn, tong_bh, thue_tncn, luong_thuc_nhan, ngay_tinh
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NOW())
    `,
    [
      nhan_vien_id,
      thang,
      nam,
      luong_thoa_thuan || 0,
      luong_p2 || 0,
      luong_p3 || 0,
      tong_luong || 0,
      bhxh || 0,
      bhyt || 0,
      bhtn || 0,
      tong_bh || 0,
      luong_thuc_nhan || 0,
    ]
  );

  return { id: result.insertId };
};

// ===============================================
// CẬP NHẬT THỦ CÔNG (GIỮ NGUYÊN)
// ===============================================
export const update = async (id: number, body: any) => {
  const [chk]: any = await pool.query(`SELECT trang_thai_duyet FROM luong WHERE id=?`, [id]);
  if (chk[0]?.trang_thai_duyet === "da_duyet") return { error: "Không thể sửa lương đã duyệt." };

  const {
    nhan_vien_id,
    thang,
    nam,
    luong_thoa_thuan,
    luong_p2,
    luong_p3,
    tong_luong,
    bhxh,
    bhyt,
    bhtn,
    tong_bh,
    luong_thuc_nhan,
  } = body;

  await pool.query(
    `
    UPDATE luong SET
      nhan_vien_id=?, thang=?, nam=?,
      luong_thoa_thuan=?, luong_p2=?, luong_p3=?, tong_luong=?,
      bhxh=?, bhyt=?, bhtn=?, tong_bh=?, luong_thuc_nhan=?, ngay_tinh=NOW()
    WHERE id=?
    `,
    [
      nhan_vien_id,
      thang,
      nam,
      luong_thoa_thuan,
      luong_p2,
      luong_p3,
      tong_luong,
      bhxh,
      bhyt,
      bhtn,
      tong_bh,
      luong_thuc_nhan,
      id,
    ]
  );

  return { ok: true };
};

// ===============================================
// XOÁ THỦ CÔNG (GIỮ NGUYÊN)
// ===============================================
export const remove = async (id: number) => {
  const [chk]: any = await pool.query(`SELECT trang_thai_duyet FROM luong WHERE id=?`, [id]);
  if (chk[0]?.trang_thai_duyet === "da_duyet") return { error: "Không thể xoá lương đã duyệt." };

  const [r] = await pool.query<ResultSetHeader>(`DELETE FROM luong WHERE id=?`, [id]);
  return r.affectedRows > 0;
};

// =====================================================================
// 🔥🔥 TÍNH LƯƠNG THÁNG - ĐÃ CẬP NHẬT LOGIC 🔥🔥
// =====================================================================

export const calcSalaryForMonth = async (args: {
  thang: number;
  nam: number;
  phongBanId: number | null;
  nhanVienId: number | null;
}) => {
  const { thang, nam, phongBanId, nhanVienId } = args;

  // Check trạng thái duyệt
  const [[state]]: any = await pool.query(
    `SELECT trang_thai_duyet 
     FROM luong 
     WHERE thang=? AND nam=? LIMIT 1`,
    [thang, nam]
  );

  if (state?.trang_thai_duyet === "da_duyet") {
    throw new Error(`Tháng ${thang}/${nam} đã duyệt lương — KHÔNG thể tính lại`);
  }

  // ⭐ LOGIC MỚI: Tính số công chuẩn thực tế (Dynamic) thay vì 26
  const so_cong_chuan = getStandardWorkingDays(thang, nam);

  let sql = `
    SELECT 
      nv.id AS nhan_vien_id,
      nv.ho_ten,
      nv.phong_ban_id,
      nv.so_nguoi_phu_thuoc,
      hd.id AS hop_dong_id,
      hd.luong_thoa_thuan,
      ptc.tong_gio,
      ptc.gio_tang_ca,
      ptc.so_ngay_cong,
      ptc.so_ngay_nghi_phep,
      ptc.so_ngay_nghi_huong_luong,
      ptc.so_ngay_nghi_khong_phep
    FROM nhan_vien nv
    JOIN hop_dong hd 
        ON hd.nhan_vien_id = nv.id 
        AND hd.trang_thai = 'con_hieu_luc'
    LEFT JOIN phan_tich_cong ptc 
        ON ptc.nhan_vien_id = nv.id 
        AND ptc.thang = ?
        AND ptc.nam = ?
    WHERE 1=1
  `;

  const params: any[] = [thang, nam];

  if (nhanVienId) {
    sql += ` AND nv.id = ?`;
    params.push(nhanVienId);
  } else if (phongBanId) {
    sql += ` AND nv.phong_ban_id = ?`;
    params.push(phongBanId);
  }

  sql += ` AND nv.trang_thai = 'dang_lam'`;

  const [rows]: any = await pool.query(sql, params);
  const results: any[] = [];

  for (const r of rows) {
    const luong_thoa_thuan = Number(r.luong_thoa_thuan || 0);
    const so_ngay_cong = Number(r.so_ngay_cong || 0);
    const so_ngay_phep = Number(r.so_ngay_nghi_phep || 0); // Đã bao gồm ốm đau như bạn yêu cầu
    const so_ngay_le = Number(r.so_ngay_nghi_huong_luong || 0);
    const gio_tang_ca = Number(r.gio_tang_ca || 0);
    const ngay_cong_lam = Number(r.tong_gio || 0) / 8;

    // ⭐ FIX: Tính lương ngày/giờ dựa trên công chuẩn thực tế
    const luong_ngay = luong_thoa_thuan / so_cong_chuan;
    const luong_gio = luong_ngay / 8;

    // P1: LƯƠNG CƠ BẢN (Công làm + Phép + Lễ)
    const luong_p1 = (so_ngay_cong + so_ngay_phep + so_ngay_le) * luong_ngay;

    // P2: PHỤ CẤP (Giữ nguyên logic cũ)
    const [phuCapList]: any = await pool.query(
      `SELECT pct.so_tien FROM phu_cap_chi_tiet pct
       WHERE pct.nhan_vien_id = ? AND (pct.hop_dong_id = ? OR (pct.thang = ? AND pct.nam = ?))`,
      [r.nhan_vien_id, r.hop_dong_id, thang, nam]
    );
    let luong_p2 = 0;
    for (const pc of phuCapList) luong_p2 += Number(pc.so_tien || 0);

    // P3: TĂNG CA + THƯỞNG/PHẠT (Giữ nguyên logic cũ)
    const luong_p3_tangca = gio_tang_ca * luong_gio;
    const [thuongPhat]: any = await pool.query(
      `SELECT loai, so_tien FROM thuong_phat WHERE (nhan_vien_id = ? OR phong_ban_id = ?) AND thang = ? AND nam = ?`,
      [r.nhan_vien_id, r.phong_ban_id, thang, nam]
    );
    let luong_p3_bonus = 0;
    for (const tp of thuongPhat) {
      if (tp.loai === "THUONG") luong_p3_bonus += Number(tp.so_tien || 0);
      else if (tp.loai === "PHAT") luong_p3_bonus -= Number(tp.so_tien || 0);
    }
    const luong_p3 = luong_p3_tangca + luong_p3_bonus;

    // TỔNG LƯƠNG
    const tong_luong = luong_p1 + luong_p2 + luong_p3;

    // BẢO HIỂM
    let bhxh = 0,
      bhyt = 0,
      bhtn = 0;
    if (so_ngay_cong + so_ngay_phep >= 14) {
      let mucDongBH = Math.min(luong_thoa_thuan, 36000000);
      bhxh = Math.round(mucDongBH * 0.08);
      bhyt = Math.round(mucDongBH * 0.015);
      bhtn = Math.round(mucDongBH * 0.01);
    }
    const tong_bh = bhxh + bhyt + bhtn;

    // THUẾ
    const giam_tru_ban_than = 11000000;
    const giam_tru_phu_thuoc = (r.so_nguoi_phu_thuoc || 0) * 4400000;
    let taxable = tong_luong - tong_bh - giam_tru_ban_than - giam_tru_phu_thuoc;
    if (taxable < 0) taxable = 0;
    const thue_tncn = calcTNCN(taxable);

    // NET
    const luong_thuc_nhan = tong_luong - tong_bh - thue_tncn;

    // SAVE DB
    await pool.execute(
      `
      INSERT INTO luong (
        nhan_vien_id, thang, nam, luong_thoa_thuan,
        luong_p1, luong_p2, luong_p3,
        ngay_cong, ngay_cong_lam, so_ngay_le,
        tong_luong, bhxh, bhyt, bhtn, tong_bh,
        thue_tncn, luong_thuc_nhan, gio_tang_ca, ngay_tinh
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        luong_thoa_thuan = VALUES(luong_thoa_thuan),
        luong_p1 = VALUES(luong_p1), luong_p2 = VALUES(luong_p2), luong_p3 = VALUES(luong_p3),
        ngay_cong = VALUES(ngay_cong), ngay_cong_lam = VALUES(ngay_cong_lam), so_ngay_le = VALUES(so_ngay_le),
        tong_luong = VALUES(tong_luong), bhxh = VALUES(bhxh), bhyt = VALUES(bhyt), bhtn = VALUES(bhtn), tong_bh = VALUES(tong_bh),
        thue_tncn = VALUES(thue_tncn), luong_thuc_nhan = VALUES(luong_thuc_nhan), gio_tang_ca = VALUES(gio_tang_ca), ngay_tinh = NOW()
      `,
      [
        r.nhan_vien_id,
        thang,
        nam,
        luong_thoa_thuan,
        luong_p1,
        luong_p2,
        luong_p3,
        so_ngay_cong,
        ngay_cong_lam,
        so_ngay_le,
        tong_luong,
        bhxh,
        bhyt,
        bhtn,
        tong_bh,
        thue_tncn,
        luong_thuc_nhan,
        gio_tang_ca,
      ]
    );

    results.push({
      nhan_vien_id: r.nhan_vien_id,
      ho_ten: r.ho_ten,
      so_ngay_cong,
      so_ngay_phep,
      so_ngay_le,
      gio_tang_ca,
      luong_p1,
      luong_p2,
      luong_p3,
      tong_luong,
      bhxh,
      bhyt,
      bhtn,
      tong_bh,
      thue_tncn,
      luong_thuc_nhan,
      thang,
      nam,
    });
  }

  return { thang, nam, count: results.length, items: results };
};

// =====================================================================
// DUYỆT LƯƠNG (GIỮ NGUYÊN)
// =====================================================================
export const toggleDuyetLuong = async (req: Request) => {
  const user = (req as any).user;
  const nguoi_id = Number(user?.nhan_vien_id);
  const thang = Number(req.body?.thang || req.query?.thang);
  const nam = Number(req.body?.nam || req.query?.nam);

  if (!thang || !nam) return { error: "Thiếu tham số tháng hoặc năm" };
  if (!nguoi_id) return { error: "Tài khoản chưa liên kết nhân viên" };

  const [rows]: any = await pool.query(
    `SELECT trang_thai_duyet FROM luong WHERE thang=? AND nam=? LIMIT 1`,
    [thang, nam]
  );
  if (!rows.length) return { error: "Chưa tính lương tháng này" };
  const current = rows[0].trang_thai_duyet;

  if (!current || current === "chua_duyet") {
    await pool.query(`UPDATE luong SET trang_thai_duyet='da_duyet' WHERE thang=? AND nam=?`, [
      thang,
      nam,
    ]);
    const [salaryRows]: any = await pool.query(
      `SELECT nhan_vien_id, luong_thuc_nhan FROM luong WHERE thang=? AND nam=?`,
      [thang, nam]
    );
    await pool.query(
      `DELETE FROM lich_su_tra_luong WHERE thang=? AND nam=? AND trang_thai='cho_xu_ly'`,
      [thang, nam]
    );
    for (const s of salaryRows) {
      await pool.query(
        `INSERT INTO lich_su_tra_luong (nhan_vien_id, thang, nam, so_tien_thuc_tra, ngay_tra, nguoi_thuc_hien_id, trang_thai, ghi_chu) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.nhan_vien_id,
          thang,
          nam,
          null,
          null,
          nguoi_id,
          "cho_xu_ly",
          `Duyệt lương tháng ${thang}/${nam}`,
        ]
      );
    }
    return { message: `Đã duyệt lương tháng ${thang}/${nam}`, state: "da_duyet" };
  }

  const [[paidInfo]]: any = await pool.query(
    `SELECT COUNT(*) AS so_giao_dich FROM lich_su_tra_luong WHERE thang=? AND nam=? AND COALESCE(so_tien_thuc_tra,0) > 0`,
    [thang, nam]
  );
  if (paidInfo?.so_giao_dich > 0) return { error: "Đã trả lương, không thể hủy duyệt." };

  await pool.query(`UPDATE luong SET trang_thai_duyet='chua_duyet' WHERE thang=? AND nam=?`, [
    thang,
    nam,
  ]);
  await pool.query(
    `DELETE FROM lich_su_tra_luong WHERE thang=? AND nam=? AND trang_thai='cho_xu_ly'`,
    [thang, nam]
  );

  try {
    await calcSalaryForMonth({ thang, nam, phongBanId: null, nhanVienId: null });
  } catch (err) {
    console.error("Lỗi tính lại lương sau hủy duyệt:", err);
  }

  return { message: `Đã hủy duyệt lương tháng ${thang}/${nam}`, state: "chua_duyet" };
};
