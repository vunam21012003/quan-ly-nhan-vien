// src/services/chucVuService.ts
import { pool } from "../db";
import { ChucVu } from "../models/chucVu";

// Lấy danh sách (tìm kiếm + phân trang + lọc theo phòng ban)
export const getAll = async (search: string, page: number, limit: number, phongBanId?: number) => {
  const offset = (page - 1) * limit;
  const params: any[] = [];
  let where = "WHERE 1=1";

  if (search) {
    where += " AND cv.ten_chuc_vu LIKE ?";
    params.push(`%${search}%`);
  }
  if (phongBanId) {
    where += " AND cv.phong_ban_id = ?";
    params.push(phongBanId);
  }

  const [rows]: any = await pool.query(
    `SELECT 
        cv.id, 
        cv.ten_chuc_vu, 
        cv.mo_ta, 
        cv.quyen_mac_dinh, 
        cv.muc_luong_co_ban, 
        cv.phong_ban_id,
        pb.ten_phong_ban
     FROM chuc_vu cv
     LEFT JOIN phong_ban pb ON pb.id = cv.phong_ban_id
     ${where}
     ORDER BY cv.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [[{ total }]]: any = await pool.query(
    `SELECT COUNT(*) as total FROM chuc_vu cv ${where}`,
    params
  );

  return { items: rows as ChucVu[], total };
};

// Tạo mới
export const create = async (data: ChucVu) => {
  const {
    ten_chuc_vu,
    mo_ta = null,
    quyen_mac_dinh = "employee",
    muc_luong_co_ban = 0,
    phong_ban_id = null,
  } = data;

  const [r]: any = await pool.query(
    `INSERT INTO chuc_vu (ten_chuc_vu, mo_ta, quyen_mac_dinh, muc_luong_co_ban, phong_ban_id)
     VALUES (?, ?, ?, ?, ?)`,
    [ten_chuc_vu, mo_ta, quyen_mac_dinh, muc_luong_co_ban, phong_ban_id]
  );

  return { id: r.insertId, message: "Đã thêm chức vụ mới" };
};

// Cập nhật
export const update = async (id: number, data: Partial<ChucVu>) => {
  const {
    ten_chuc_vu,
    mo_ta = null,
    quyen_mac_dinh = "employee",
    muc_luong_co_ban = 0,
    phong_ban_id = null,
  } = data;

  const [r]: any = await pool.query(
    `UPDATE chuc_vu
     SET ten_chuc_vu=?, mo_ta=?, quyen_mac_dinh=?, muc_luong_co_ban=?, phong_ban_id=?
     WHERE id=?`,
    [ten_chuc_vu, mo_ta, quyen_mac_dinh, muc_luong_co_ban, phong_ban_id, id]
  );

  return r.affectedRows > 0;
};

// Xoá
export const remove = async (id: number) => {
  const [r]: any = await pool.query(`DELETE FROM chuc_vu WHERE id=?`, [id]);
  return r.affectedRows > 0;
};
