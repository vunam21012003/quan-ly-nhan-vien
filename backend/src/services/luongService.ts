// ===============================================
// src/services/luongService.ts
// ===============================================
import { pool } from "../db";
import { RowDataPacket, ResultSetHeader } from "mysql2";

/**
 * ===============================================
 * TỶ LỆ BẢO HIỂM (phần nhân viên chịu)
 * ===============================================
 */
const INSURANCE_RATES = {
  BHXH: 0.08,
  BHYT: 0.015,
  BHTN: 0.01,
};

/**
 * ===============================================
 * LẤY DANH SÁCH LƯƠNG (cho admin/manager)
 * ===============================================
 */
export const getAll = async (req: any) => {
  const { thang, nam, page = 1, limit = 10 } = req.query;
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

  const [rows] = await pool.query<RowDataPacket[]>(
    `
    SELECT l.*, nv.ho_ten 
    FROM luong l
    JOIN nhan_vien nv ON nv.id = l.nhan_vien_id
    WHERE 1=1 ${where}
    ORDER BY l.nam DESC, l.thang DESC
    LIMIT ? OFFSET ?
  `,
    [...params, Number(limit), offset]
  );

  const [[{ total }]]: any = await pool.query(
    `SELECT COUNT(*) as total FROM luong l WHERE 1=1 ${where}`,
    params
  );

  return { items: rows, total };
};

/**
 * ===============================================
 * LẤY LƯƠNG CỦA CHÍNH NHÂN VIÊN
 * ===============================================
 */
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

/**
 * ===============================================
 * LẤY CHI TIẾT BẢN LƯƠNG
 * ===============================================
 */
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

/**
 * ===============================================
 * TẠO BẢN LƯƠNG THỦ CÔNG (nếu cần)
 * ===============================================
 */
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
      tong_luong, bhxh, bhyt, bhtn, tong_bh, luong_thuc_nhan, ngay_tinh
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
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

/**
 * ===============================================
 * CẬP NHẬT BẢN LƯƠNG
 * ===============================================
 */
export const update = async (id: number, body: any) => {
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
    UPDATE luong
    SET nhan_vien_id=?, thang=?, nam=?, 
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

/**
 * ===============================================
 * XOÁ BẢN LƯƠNG
 * ===============================================
 */
export const remove = async (id: number) => {
  const [result] = await pool.query<ResultSetHeader>(`DELETE FROM luong WHERE id = ?`, [id]);
  return result.affectedRows > 0;
};

/**
 * ===============================================
 * TÍNH LƯƠNG THÁNG THEO MÔ HÌNH 3P (không dùng luong_p1)
 * ===============================================
 */
export const calcSalaryForMonth = async (thang: number, nam: number) => {
  // 1️⃣ Lấy dữ liệu tổng hợp từ nhân viên, hợp đồng, chấm công
  const [rows]: any = await pool.query(
    `
    SELECT 
      nv.id AS nhan_vien_id,
      nv.ho_ten,
      nv.phong_ban_id,
      hd.luong_thoa_thuan,
      hd.phu_cap_co_dinh,
      hd.phu_cap_tham_nien,
      hd.phu_cap_nang_luc,
      hd.phu_cap_trach_nhiem,
      ptc.so_ngay_cong,
      ptc.so_ngay_nghi_phep,
      ptc.so_ngay_nghi_huong_luong, -- ✅ BỔ SUNG: Lấy công ngày nghỉ hưởng lương
      ptc.gio_tang_ca
    FROM nhan_vien nv
    JOIN hop_dong hd 
      ON hd.nhan_vien_id = nv.id AND hd.trang_thai='con_hieu_luc'
    LEFT JOIN phan_tich_cong ptc 
      ON ptc.nhan_vien_id = nv.id AND ptc.thang = ? AND ptc.nam = ?
  `,
    [thang, nam]
  );

  // 2️⃣ Lấy dữ liệu thưởng/phạt nhân viên và phòng ban
  const [thuongPhat]: any = await pool.query(
    `
    SELECT phong_ban_id, nhan_vien_id, loai, SUM(so_tien) as tong_tien
    FROM thuong_phat
    WHERE thang = ? AND nam = ?
    GROUP BY phong_ban_id, nhan_vien_id, loai
  `,
    [thang, nam]
  );

  // Map nhanh dữ liệu thưởng/phạt
  const byNV: Record<number, { thuong: number; phat: number }> = {};
  const byPB: Record<number, { thuong: number; phat: number }> = {};

  for (const tp of thuongPhat) {
    const thuong = tp.loai === "THUONG" ? Number(tp.tong_tien) : 0;
    const phat = tp.loai === "PHAT" ? Number(tp.tong_tien) : 0;

    if (tp.nhan_vien_id) {
      const nvId = Number(tp.nhan_vien_id);
      if (!byNV[nvId]) byNV[nvId] = { thuong: 0, phat: 0 };
      byNV[nvId].thuong += thuong;
      byNV[nvId].phat += phat;
    } else if (tp.phong_ban_id) {
      const pbId = Number(tp.phong_ban_id);
      if (!byPB[pbId]) byPB[pbId] = { thuong: 0, phat: 0 };
      byPB[pbId].thuong += thuong;
      byPB[pbId].phat += phat;
    }
  }

  // 3️⃣ Đếm số nhân viên trong mỗi phòng ban để chia đều thưởng/phạt phòng ban
  const [pbCount]: any = await pool.query(`
    SELECT phong_ban_id, COUNT(*) AS so_nv
    FROM nhan_vien
    GROUP BY phong_ban_id
  `);
  const nvInPB: Record<number, number> = {};
  for (const r of pbCount) nvInPB[r.phong_ban_id] = r.so_nv;

  const results: any[] = [];

  // 4️⃣ Tính lương cho từng nhân viên
  for (const r of rows) {
    const luong_thoa_thuan_goc = Number(r.luong_thoa_thuan || 0); // Lương thỏa thuận gốc (từ HĐ)

    // LƯU Ý: so_ngay_cong phải là DECIMAL trong DB để tránh sai lệch công lẻ
    const so_ngay_cong = Number(r.so_ngay_cong || 0);

    const so_ngay_nghi_phep = Number(r.so_ngay_nghi_phep || 0);
    const so_ngay_nghi_huong_luong = Number(r.so_ngay_nghi_huong_luong || 0); // Ngày Lễ/Tết
    const gio_tang_ca = Number(r.gio_tang_ca || 0);

    // Lấy thưởng/phạt cá nhân
    const tong_thuong_nv = byNV[r.nhan_vien_id]?.thuong || 0;
    const tong_phat_nv = byNV[r.nhan_vien_id]?.phat || 0;

    // Lấy thưởng/phạt chia phòng ban
    const thuong_pb = byPB[r.phong_ban_id]?.thuong || 0;
    const phat_pb = byPB[r.phong_ban_id]?.phat || 0;
    const so_nv_pb = nvInPB[r.phong_ban_id] || 1;

    const thuong_pb_moi_nv = thuong_pb / so_nv_pb;
    const phat_pb_moi_nv = phat_pb / so_nv_pb;

    // 5️⃣ Tính các phần P1, P2, P3
    const luong_ngay = luong_thoa_thuan_goc / 26;
    const luong_gio = luong_thoa_thuan_goc / 208; // 26 ngày x 8 giờ

    // ✅ SỬA LỖI P1: Tính đủ cả Công thực tế (so_ngay_cong), Nghỉ phép (so_ngay_nghi_phep) và Ngày Lễ (so_ngay_nghi_huong_luong)
    const P1 = (so_ngay_cong + so_ngay_nghi_phep + so_ngay_nghi_huong_luong) * luong_ngay;

    const phu_cap_co_dinh = Number(r.phu_cap_co_dinh || 0);
    const phu_cap_tham_nien = Number(r.phu_cap_tham_nien || 0);
    const phu_cap_nang_luc = Number(r.phu_cap_nang_luc || 0);
    const phu_cap_trach_nhiem = Number(r.phu_cap_trach_nhiem || 0);

    const P2 = phu_cap_co_dinh + phu_cap_tham_nien + phu_cap_nang_luc + phu_cap_trach_nhiem;

    // Tăng ca đã nhân hệ số nên chỉ nhân với đơn giá giờ
    const P3 =
      gio_tang_ca * luong_gio +
      (tong_thuong_nv - tong_phat_nv) +
      (thuong_pb_moi_nv - phat_pb_moi_nv);

    const tong_luong = P1 + P2 + P3;

    // 6️⃣ Tính bảo hiểm phần nhân viên chịu (ĐÃ SỬA: Dùng đúng cơ sở tính BHXH)
    // Cơ sở tính BHXH: Lương Gốc + Phụ cấp phải đóng BHXH (Giả định: Cố định, Thâm niên)
    const luong_tinh_bhxh = luong_thoa_thuan_goc + phu_cap_co_dinh + phu_cap_tham_nien;

    const bhxh = luong_tinh_bhxh * INSURANCE_RATES.BHXH; // << Dùng luong_tinh_bhxh
    const bhyt = luong_tinh_bhxh * INSURANCE_RATES.BHYT;
    const bhtn = luong_tinh_bhxh * INSURANCE_RATES.BHTN;
    const tong_bh = bhxh + bhyt + bhtn;

    // Tính Thuế TNCN (Cần logic phức tạp hơn, tạm để 0)
    const thue_tncn = 0;

    const luong_thuc_nhan = tong_luong - tong_bh - thue_tncn;

    results.push({
      nhan_vien_id: r.nhan_vien_id,
      ho_ten: r.ho_ten,
      phong_ban_id: r.phong_ban_id,
      luong_thoa_thuan: P1, // ✅ Ghi P1 vào luong_thoa_thuan (tên cột trong bảng luong)
      luong_p2: P2,
      luong_p3: P3,
      tong_luong,
      bhxh,
      bhyt,
      bhtn,
      tong_bh,
      thue_tncn, // Bổ sung
      luong_thuc_nhan,
    });

    // 7️⃣ Ghi hoặc cập nhật bản lương vào DB
    await pool.execute(
      `
      INSERT INTO luong (
        nhan_vien_id, thang, nam,
        luong_thoa_thuan, luong_p2, luong_p3,
        tong_luong, bhxh, bhyt, bhtn, tong_bh, thue_tncn, luong_thuc_nhan, ngay_tinh
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        luong_thoa_thuan=VALUES(luong_thoa_thuan),
        luong_p2=VALUES(luong_p2),
        luong_p3=VALUES(luong_p3),
        tong_luong=VALUES(tong_luong),
        bhxh=VALUES(bhxh),
        bhyt=VALUES(bhyt),
        bhtn=VALUES(bhtn),
        tong_bh=VALUES(tong_bh),
        thue_tncn=VALUES(thue_tncn), -- Bổ sung
        luong_thuc_nhan=VALUES(luong_thuc_nhan),
        ngay_tinh=NOW()
    `,
      [
        r.nhan_vien_id,
        thang,
        nam,
        P1, // Ghi giá trị tính toán P1 vào cột luong_thoa_thuan
        P2,
        P3,
        tong_luong,
        bhxh,
        bhyt,
        bhtn,
        tong_bh,
        thue_tncn, // Ghi 0 (hoặc giá trị tính TNCN)
        luong_thuc_nhan,
      ]
    );
  }

  return { thang, nam, count: results.length, items: results };
};
