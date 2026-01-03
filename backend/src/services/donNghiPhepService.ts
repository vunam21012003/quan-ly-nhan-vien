// src/services/donNghiPhepService.ts
import { pool } from "../db";
import { ResultSetHeader } from "mysql2";
import { tao as taoThongBao } from "./thongBaoService";

//  Tạo đơn xin nghỉ mới
export const createDonNghi = async (data: {
  nhan_vien_id: number;
  ngay_bat_dau: string;
  ngay_ket_thuc?: string;
  buoi_nghi: "sang" | "chieu" | "ca_ngay";
  loai_nghi: "phep_nam" | "khong_luong" | "om_dau" | "khac";
  ly_do: string;
}) => {
  const { nhan_vien_id, ngay_bat_dau, buoi_nghi, loai_nghi, ly_do } = data;
  let { ngay_ket_thuc } = data;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  if (ngay_bat_dau === todayStr) {
  }
  let so_ngay = 0;

  // Xử lý logic ngày kết thúc
  if (buoi_nghi !== "ca_ngay") {
    so_ngay = 0.5;
    ngay_ket_thuc = ngay_bat_dau;
  } else {
    if (!ngay_ket_thuc) ngay_ket_thuc = ngay_bat_dau;

    const dStart = new Date(ngay_bat_dau);
    const dEnd = new Date(ngay_ket_thuc);

    if (dEnd < dStart) {
      throw new Error("Ngày kết thúc không được nhỏ hơn ngày bắt đầu");
    }

    // LOGIC TÍNH SỐ NGÀY
    for (let d = new Date(dStart); d <= dEnd; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const dateNum = d.getDate();
      const monthNum = d.getMonth() + 1;

      const isFixedHoliday =
        (dateNum === 1 && monthNum === 1) ||
        (dateNum === 30 && monthNum === 4) ||
        (dateNum === 1 && monthNum === 5) ||
        (dateNum === 2 && monthNum === 9);

      if (dayOfWeek !== 0 && !isFixedHoliday) {
        so_ngay += 1;
      }
    }
  }

  // Tạo đơn
  const sqlInsert = `
    INSERT INTO don_nghi_phep 
    (nhan_vien_id, ngay_bat_dau, ngay_ket_thuc, so_ngay, buoi_nghi, loai_nghi, ly_do, trang_thai)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'cho_duyet')
  `;

  const [result] = await pool.query<ResultSetHeader>(sqlInsert, [
    nhan_vien_id,
    ngay_bat_dau,
    ngay_ket_thuc,
    so_ngay,
    buoi_nghi,
    loai_nghi,
    ly_do,
  ]);

  const donId = result.insertId;

  // Phần gửi thông báo
  const [[nvInfo]]: any = await pool.query(
    `
    SELECT 
      nv.id,
      nv.phong_ban_id,
      cv.quyen_mac_dinh AS role
    FROM nhan_vien nv
    LEFT JOIN tai_khoan tk ON tk.nhan_vien_id = nv.id
    LEFT JOIN chuc_vu cv ON nv.chuc_vu_id = cv.id
    WHERE nv.id = ?
    LIMIT 1
    `,
    [nhan_vien_id]
  );

  const role = nvInfo?.role || "employee";
  const phong_ban_id = nvInfo?.phong_ban_id || null;

  let nguoiNhanThongBao: number | null = null;

  if (role === "manager") {
    const [[adminRow]]: any = await pool.query(
      `
      SELECT nv.id AS nhan_vien_id
      FROM nhan_vien nv
      LEFT JOIN tai_khoan tk ON tk.nhan_vien_id = nv.id
      LEFT JOIN chuc_vu cv ON nv.chuc_vu_id = cv.id
      WHERE cv.quyen_mac_dinh = 'admin'
      LIMIT 1
      `
    );
    nguoiNhanThongBao = adminRow?.nhan_vien_id || null;
  } else {
    if (phong_ban_id) {
      const [[rowManager]]: any = await pool.query(
        `
        SELECT nvManager.id AS nhan_vien_id
        FROM phong_ban pb
        LEFT JOIN tai_khoan tkManager ON pb.manager_taikhoan_id = tkManager.id
        LEFT JOIN nhan_vien nvManager ON tkManager.nhan_vien_id = nvManager.id
        WHERE pb.id = ?
        `,
        [phong_ban_id]
      );
      nguoiNhanThongBao = rowManager?.nhan_vien_id || null;
    }
  }

  if (nguoiNhanThongBao) {
    await taoThongBao({
      nguoi_nhan_id: nguoiNhanThongBao,
      loai: "don_nghi_phep",
      tieu_de: "Có đơn nghỉ phép mới",
      noi_dung: `Nhân viên ID ${nhan_vien_id} đã gửi đơn nghỉ (Tổng: ${so_ngay} ngày công).`,
      tham_chieu_loai: "don_nghi_phep",
      tham_chieu_id: donId,
      nguoi_tao_id: nhan_vien_id,
    });
  }

  return { id: donId, so_ngay };
};

export const getListDonNghi = async (
  nhanVienIdCurrent: number,
  role: string,
  managedDepartmentIds: number[],
  filters: { trang_thai?: string; month?: number; year?: number }
) => {
  let whereClause = "1=1";
  const params: any[] = [];

  // Phân quyền dữ liệu
  if (role === "employee") {
    // Nhân viên chỉ xem đơn của chính mình
    whereClause += " AND d.nhan_vien_id = ?";
    params.push(nhanVienIdCurrent);
  } else if (role === "manager") {
    // Manager xem đơn của nhân viên thuộc phòng mình
    if (managedDepartmentIds.length > 0) {
      whereClause += ` AND nv.phong_ban_id IN (?)`;
      params.push(managedDepartmentIds);
    } else {
      whereClause += " AND d.nhan_vien_id = ?";
      params.push(nhanVienIdCurrent);
    }
  } else if (role === "admin") {
    whereClause += " AND cv.quyen_mac_dinh = 'manager'";
  }

  // Filter UI
  if (filters.trang_thai) {
    whereClause += " AND d.trang_thai = ?";
    params.push(filters.trang_thai);
  }
  if (filters.year) {
    whereClause += " AND YEAR(d.ngay_bat_dau) = ?";
    params.push(filters.year);
  }
  if (filters.month) {
    whereClause += " AND MONTH(d.ngay_bat_dau) = ?";
    params.push(filters.month);
  }

  const sql = `
    SELECT 
      d.*,
      nv.ho_ten,
      nv.anh_dai_dien,
      cv.ten_chuc_vu,
      pb.ten_phong_ban,
      (
        SELECT COALESCE(SUM(sub.so_ngay), 0)
        FROM don_nghi_phep sub
        WHERE sub.nhan_vien_id = d.nhan_vien_id 
          AND sub.trang_thai = 'da_duyet' 
          AND sub.loai_nghi = 'phep_nam'
          AND YEAR(sub.ngay_bat_dau) = YEAR(d.ngay_bat_dau)
      ) AS tong_nghi_phep_nam_nay
    FROM don_nghi_phep d
    JOIN nhan_vien nv ON d.nhan_vien_id = nv.id
    LEFT JOIN chuc_vu cv ON nv.chuc_vu_id = cv.id
    LEFT JOIN phong_ban pb ON nv.phong_ban_id = pb.id
    WHERE ${whereClause}
    ORDER BY d.created_at DESC
  `;

  const [rows] = await pool.query(sql, params);
  return rows;
};

//  Duyệt đơn
export const approveDonNghi = async (donId: number, managerNhanVienId: number) => {
  const [rows]: any = await pool.query(
    `SELECT nhan_vien_id, trang_thai, ngay_ket_thuc FROM don_nghi_phep WHERE id = ?`,
    [donId]
  );

  const don = rows[0];
  if (!don) {
    throw new Error("Không tìm thấy đơn nghỉ phép.");
  }

  const nhanVienId = don.nhan_vien_id;

  // Chỉ xử lý đơn đang chờ duyệt
  if (don.trang_thai !== "cho_duyet") {
    throw new Error("Đơn nghỉ này không còn ở trạng thái chờ duyệt.");
  }

  if (don.ngay_ket_thuc) {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    if (don.ngay_ket_thuc < todayStr) {
      throw new Error("Thời gian xin nghỉ của đơn này đã hết hạn, không thể duyệt nữa.");
    }
  }

  await pool.query(`CALL duyet_don_nghi_phep(?, ?)`, [donId, managerNhanVienId]);

  // Thông báo cho nhân viên
  await taoThongBao({
    nguoi_nhan_id: nhanVienId,
    loai: "don_nghi_phep",
    tieu_de: "Đơn nghỉ đã được duyệt",
    noi_dung: `Đơn nghỉ phép của bạn đã được duyệt.`,
    tham_chieu_loai: "don_nghi_phep",
    tham_chieu_id: donId,
    nguoi_tao_id: managerNhanVienId,
  });

  return true;
};

// Từ chối đơn
export const rejectDonNghi = async (donId: number, managerNhanVienId: number, lyDo: string) => {
  await pool.query(
    `
    UPDATE don_nghi_phep 
    SET trang_thai = 'tu_choi', nguoi_duyet_id = ?, ly_do_tu_choi = ? 
    WHERE id = ?
  `,
    [managerNhanVienId, lyDo, donId]
  );

  const [rows]: any = await pool.query(`SELECT nhan_vien_id FROM don_nghi_phep WHERE id = ?`, [
    donId,
  ]);

  const nhanVienId = rows[0]?.nhan_vien_id;

  await taoThongBao({
    nguoi_nhan_id: nhanVienId,
    loai: "don_nghi_phep",
    tieu_de: "Đơn nghỉ bị từ chối",
    noi_dung: `Đơn nghỉ của bạn đã bị từ chối. Lý do: ${lyDo}`,
    tham_chieu_loai: "don_nghi_phep",
    tham_chieu_id: donId,
    nguoi_tao_id: managerNhanVienId,
  });

  return true;
};

//  Hủy đơn
export const cancelDonNghi = async (donId: number, nhanVienId: number) => {
  const sql = `
    UPDATE don_nghi_phep 
    SET trang_thai = 'da_huy' 
    WHERE id = ? AND nhan_vien_id = ? AND trang_thai = 'cho_duyet'
  `;
  const [res] = await pool.query<ResultSetHeader>(sql, [donId, nhanVienId]);

  if (res.affectedRows > 0) {
    await pool.query(
      `
      DELETE FROM thong_bao
      WHERE tham_chieu_loai = 'don_nghi_phep'
        AND tham_chieu_id = ?
        AND loai = 'don_nghi_phep'
    `,
      [donId]
    );
  }

  return res.affectedRows > 0;
};
