// src/services/phongBanService.ts
import { pool } from "../db";

// Lấy danh sách phòng ban có phân trang + tìm kiếm
export const getAll = async (search: string, page: number, limit: number) => {
  const offset = (page - 1) * limit;

  let where = "";
  const params: any[] = [];
  if (search) {
    where = "WHERE pb.ten_phong_ban LIKE ?";
    params.push(`%${search}%`);
  }

  const [rows]: any = await pool.query(
    `SELECT 
        pb.id, 
        pb.ten_phong_ban,              -- tên chuẩn
        pb.ten_phong_ban AS ten,       -- alias để tương thích code cũ
        pb.mo_ta, 
        pb.manager_taikhoan_id,
        nv.ho_ten AS manager_name
     FROM phong_ban pb
     LEFT JOIN tai_khoan tk ON pb.manager_taikhoan_id = tk.id
     LEFT JOIN nhan_vien nv ON tk.nhan_vien_id = nv.id
     ${where}
     ORDER BY pb.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [[{ total }]]: any = await pool.query(
    `SELECT COUNT(*) as total FROM phong_ban pb ${where}`,
    params
  );

  return { items: rows, total };
};

// Tạo mới
export const create = async (ten_phong_ban: string, mo_ta?: string, managerId?: number) => {
  const [r]: any = await pool.query(
    `INSERT INTO phong_ban (ten_phong_ban, mo_ta, manager_taikhoan_id)
     VALUES (?, ?, ?)`,
    [ten_phong_ban, mo_ta || null, managerId || null]
  );
  return { id: r.insertId };
};

// Cập nhật
export const update = async (
  id: number,
  ten_phong_ban: string,
  mo_ta?: string,
  managerId?: number
) => {
  const [r]: any = await pool.query(
    `UPDATE phong_ban
     SET ten_phong_ban = ?, mo_ta = ?, manager_taikhoan_id = ?
     WHERE id = ?`,
    [ten_phong_ban || null, mo_ta || null, managerId || null, id]
  );
  return { ok: r.affectedRows > 0 };
};

// Xoá
export const remove = async (id: number) => {
  const [r]: any = await pool.query(`DELETE FROM phong_ban WHERE id = ?`, [id]);
  return { ok: r.affectedRows > 0 };
};
