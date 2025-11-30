//donNghiPhepService.ts
import { pool } from "../db";
import { ResultSetHeader } from "mysql2";

// Helper tính số ngày
const calculateDays = (start: string, end: string): number => {
  const d1 = new Date(start);
  const d2 = new Date(end);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

/**
 * Tạo đơn xin nghỉ mới
 */
export const createDonNghi = async (data: {
  nhan_vien_id: number;
  ngay_bat_dau: string;
  ngay_ket_thuc?: string; // Nếu nghỉ 0.5 thì FE có thể không gửi ngày kết thúc
  buoi_nghi: "sang" | "chieu" | "ca_ngay";
  loai_nghi: string;
  ly_do: string;
}) => {
  const { nhan_vien_id, ngay_bat_dau, buoi_nghi, loai_nghi, ly_do } = data;
  let { ngay_ket_thuc } = data;

  let so_ngay = 1.0;

  if (buoi_nghi !== "ca_ngay") {
    // Nghỉ nửa buổi => mặc định start = end, so_ngay = 0.5
    so_ngay = 0.5;
    ngay_ket_thuc = ngay_bat_dau;
  } else {
    // Nghỉ cả ngày
    if (!ngay_ket_thuc) ngay_ket_thuc = ngay_bat_dau;
    so_ngay = calculateDays(ngay_bat_dau, ngay_ket_thuc);
  }

  const sql = `
    INSERT INTO don_nghi_phep 
    (nhan_vien_id, ngay_bat_dau, ngay_ket_thuc, so_ngay, buoi_nghi, loai_nghi, ly_do, trang_thai)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'cho_duyet')
  `;

  const [result] = await pool.query<ResultSetHeader>(sql, [
    nhan_vien_id,
    ngay_bat_dau,
    ngay_ket_thuc,
    so_ngay,
    buoi_nghi,
    loai_nghi,
    ly_do,
  ]);

  return { id: result.insertId, so_ngay };
};

/**
 * Lấy danh sách đơn nghỉ (Có filter theo quyền)
 * - Nếu là Employee: Chỉ xem của mình
 * - Nếu là Manager/Admin: Xem được của nhân viên cấp dưới + Có cột tổng số ngày đã nghỉ trong năm
 */
export const getListDonNghi = async (
  userId: number,
  role: string,
  managedDepartmentIds: number[],
  filters: { trang_thai?: string; month?: number; year?: number }
) => {
  let whereClause = "1=1";
  const params: any[] = [];

  // 1. Phân quyền dữ liệu
  if (role === "employee") {
    whereClause += " AND d.nhan_vien_id = ?";
    params.push(userId); // Lấy nhan_vien_id từ token (cần convert user.id -> nhan_vien_id ở controller)
  } else if (role === "manager") {
    if (managedDepartmentIds.length > 0) {
      whereClause += ` AND nv.phong_ban_id IN (?)`;
      params.push(managedDepartmentIds);
    } else {
      // Manager không quản lý phòng nào -> chỉ xem của mình
      whereClause += " AND d.nhan_vien_id = ?";
      params.push(userId);
    }
  }
  // Admin thấy hết (không cần AND)

  // 2. Filter từ UI
  if (filters.trang_thai) {
    whereClause += " AND d.trang_thai = ?";
    params.push(filters.trang_thai);
  }
  if (filters.year) {
    whereClause += " AND YEAR(d.ngay_bat_dau) = ?";
    params.push(filters.year);
  }

  const sql = `
    SELECT 
      d.*,
      nv.ho_ten,
      nv.anh_dai_dien,
      cv.ten_chuc_vu,
      pb.ten_phong_ban,
      -- Subquery tính tổng số ngày nghỉ phép năm (phep_nam) đã DUYỆT trong năm của nhân viên này
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

/**
 * Duyệt đơn (Gọi Procedure)
 */
export const approveDonNghi = async (donId: number, managerId: number) => {
  // managerId ở đây là ID của bảng NHAN_VIEN (người duyệt)
  const sql = `CALL duyet_don_nghi_phep(?, ?)`;
  await pool.query(sql, [donId, managerId]);
  return true;
};

/**
 * Từ chối đơn
 */
export const rejectDonNghi = async (donId: number, managerId: number, lyDo: string) => {
  const sql = `
    UPDATE don_nghi_phep 
    SET trang_thai = 'tu_choi', nguoi_duyet_id = ?, ly_do_tu_choi = ? 
    WHERE id = ?
  `;
  await pool.query(sql, [managerId, lyDo, donId]);
  return true;
};

/**
 * Hủy đơn (Nhân viên tự hủy khi chưa duyệt)
 */
export const cancelDonNghi = async (donId: number, nhanVienId: number) => {
  const sql = `
    UPDATE don_nghi_phep 
    SET trang_thai = 'da_huy' 
    WHERE id = ? AND nhan_vien_id = ? AND trang_thai = 'cho_duyet'
  `;
  const [res] = await pool.query<ResultSetHeader>(sql, [donId, nhanVienId]);
  return res.affectedRows > 0;
};
